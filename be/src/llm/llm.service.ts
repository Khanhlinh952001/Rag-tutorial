import { Injectable } from '@nestjs/common';

@Injectable()
export class LlmService {
  async answer(question: string, contexts: string[]): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return `LLM API 키가 설정되지 않았습니다. 검색된 컨텍스트:\n\n${contexts.slice(0, 3).join('\n\n---\n\n')}`;
    }

    const prompt = [
      'You are a helpful assistant. Answer using the provided context.',
      'If context is insufficient, say so clearly.',
      '',
      `Question: ${question}`,
      '',
      'Context:',
      contexts.slice(0, 5).join('\n\n'),
    ].join('\n');

    const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    const maxAttempts = Number(process.env.OPENAI_MAX_RETRIES ?? 1);
    const retryBaseMs = Number(process.env.OPENAI_RETRY_BASE_MS ?? 300);
    const requestTimeoutMs = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? 6000);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response: Response | null = null;
      let transportError: string | null = null;
      try {
        response = await fetch(`${baseUrl}/responses`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
            input: prompt,
          }),
          signal: controller.signal,
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          response = null;
        } else {
          transportError = error instanceof Error ? error.message : 'unknown transport error';
        }
      } finally {
        clearTimeout(timeout);
      }

      if (response == null) {
        if (attempt === maxAttempts) {
          if (transportError) {
            return this.buildExtractiveFallbackAnswer(
              question,
              contexts,
              `LLM transport error: ${transportError}`,
            );
          }
          return this.buildExtractiveFallbackAnswer(
            question,
            contexts,
            `LLM timeout ${requestTimeoutMs}ms`,
          );
        }
        await this.sleep(retryBaseMs * attempt);
        continue;
      }

      if (response.ok) {
        const json = (await response.json()) as Record<string, unknown>;
        const text = this.extractResponseText(json);
        if (text) {
          return text;
        }
        return this.buildExtractiveFallbackAnswer(
          question,
          contexts,
          'LLM empty output',
        );
      }

      const shouldRetry = response.status === 429 || response.status >= 500;
      if (!shouldRetry || attempt === maxAttempts) {
        return this.buildExtractiveFallbackAnswer(
          question,
          contexts,
          `LLM failed ${response.status}`,
        );
      }

      await this.sleep(retryBaseMs * attempt);
    }

    return this.buildExtractiveFallbackAnswer(
      question,
      contexts,
      'LLM retry exhausted',
    );
  }

  async answerGeneral(question: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return 'LLM API 키가 설정되지 않아 일반 지식 답변을 생성할 수 없습니다.';
    }

    const prompt = [
      'You are a helpful assistant.',
      'Answer the question directly and concisely based on general knowledge.',
      'If uncertain, state uncertainty briefly.',
      '',
      `Question: ${question}`,
    ].join('\n');

    const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    const maxAttempts = Number(process.env.OPENAI_MAX_RETRIES ?? 1);
    const retryBaseMs = Number(process.env.OPENAI_RETRY_BASE_MS ?? 300);
    const requestTimeoutMs = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? 6000);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response: Response | null = null;
      try {
        response = await fetch(`${baseUrl}/responses`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
            input: prompt,
          }),
          signal: controller.signal,
        });
      } catch {
        response = null;
      } finally {
        clearTimeout(timeout);
      }

      if (response?.ok) {
        const json = (await response.json()) as Record<string, unknown>;
        const text = this.extractResponseText(json);
        if (text) return text;
      }

      const shouldRetry =
        response == null || response.status === 429 || response.status >= 500;
      if (!shouldRetry || attempt === maxAttempts) {
        break;
      }
      await this.sleep(retryBaseMs * attempt);
    }

    return [
      '현재 일반 지식 답변을 생성하는 중 일시적인 오류가 발생했습니다.',
      '잠시 후 다시 시도해 주세요.',
    ].join('\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractResponseText(payload: Record<string, unknown>): string {
    const outputText = payload.output_text;
    if (typeof outputText === 'string' && outputText.trim().length > 0) {
      return outputText.trim();
    }

    const output = payload.output;
    if (!Array.isArray(output)) {
      return '';
    }

    const chunks: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;

      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const text = (part as { text?: unknown }).text;
        if (typeof text === 'string' && text.trim().length > 0) {
          chunks.push(text.trim());
        }
      }
    }

    return chunks.join('\n').trim();
  }

  private buildExtractiveFallbackAnswer(
    question: string,
    contexts: string[],
    reason: string,
  ): string {
    const rawSnippets = contexts
      .map((c) => this.normalizeSnippet(c))
      .filter((s) => s.length > 0)
      .slice(0, 8);
    const deduped = this.dedupeRetrievalSnippets(rawSnippets);
    const relevantSnippets = this.filterRelevantSnippets(question, deduped);

    if (relevantSnippets.length === 0) {
      return [
        '현재 보유한 자료에서 질문과 직접적으로 연결되는 근거를 찾지 못했습니다.',
        '질문을 더 구체적으로 작성하거나, 관련 문서를 추가한 뒤 다시 시도해 주세요.',
      ].join('\n');
    }

    const mainPoint = relevantSnippets[0];
    /** 짧은 추가 근거만 (본문과 중복·장문 반복 방지) */
    const supporting = relevantSnippets.slice(1, 3);

    const supportingBlock =
      supporting.length > 0
        ? `\n\n#### 추가 근거\n\n${supporting.map((snippet) => `- ${snippet}`).join('\n')}`
        : '';

    const footer =
      reason === 'LLM empty output'
        ? '\n\n---\n\n_검색 스니펫 요약 · 생성 모델 응답 없음_'
        : '\n\n---\n\n_검색 스니펫 요약 · 일시 오류로 대체 응답_';

    return `#### 답변\n\n${mainPoint}${supportingBlock}${footer}`;
  }

  /** 동일·포함 관계 스니펫 제거 (긴 본문이 여러 청크로 잡혀 반복될 때) */
  private dedupeRetrievalSnippets(snippets: string[]): string[] {
    if (snippets.length <= 1) return snippets;
    const indexed = snippets.map((text, idx) => ({ text, idx }));
    const sorted = [...indexed].sort((a, b) => b.text.length - a.text.length);
    const kept: { text: string; idx: number }[] = [];
    for (const item of sorted) {
      const n = this.normalizeForDedupe(item.text);
      if (n.length < 40) continue;
      const head = n.slice(0, Math.min(140, n.length));
      const redundant = kept.some((k) => {
        const kn = this.normalizeForDedupe(k.text);
        return kn.includes(head);
      });
      if (redundant) continue;
      kept.push(item);
    }
    return kept.sort((a, b) => a.idx - b.idx).map((x) => x.text);
  }

  private normalizeForDedupe(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private normalizeSnippet(text: string): string {
    return text
      .replace(/[•▪◦●]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.。]+$/u, '');
  }

  private filterRelevantSnippets(question: string, snippets: string[]): string[] {
    const queryTokens = this.tokenize(question);
    if (queryTokens.length === 0) return snippets;

    const minOverlap = Number(process.env.FALLBACK_MIN_KEYWORD_OVERLAP ?? 0.2);
    const minMatchedTokens = Number(process.env.FALLBACK_MIN_MATCHED_TOKENS ?? 2);

    return snippets.filter((snippet) => {
      const snippetTokens = new Set(this.tokenize(snippet));
      const matched = queryTokens.filter((token) => snippetTokens.has(token)).length;
      const overlap = matched / queryTokens.length;
      return matched >= minMatchedTokens && overlap >= minOverlap;
    });
  }

  private tokenize(text: string): string[] {
    const stopwords = new Set([
      // Vietnamese
      'la',
      'là',
      'co',
      'có',
      'va',
      'và',
      'cua',
      'của',
      'cho',
      'voi',
      'với',
      'gi',
      'gì',
      'nao',
      'nào',
      // Korean
      '은',
      '는',
      '이',
      '가',
      '을',
      '를',
      '에',
      '의',
      '와',
      '과',
      '도',
      // English
      'the',
      'a',
      'an',
      'is',
      'are',
      'what',
      'how',
      'why',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !stopwords.has(token));
  }
}
