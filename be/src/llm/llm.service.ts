import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';

import { createAsyncConcurrencyLimiter } from '../shared/concurrency-limiter';

function parseLlmConcurrent(): number {
  const n = Number(process.env.LLM_MAX_CONCURRENT ?? 16);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 16;
}

export type RagContextBlock = {
  content: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class LlmService {
  private readonly runWithLlmLimit = createAsyncConcurrencyLimiter(parseLlmConcurrent());

  async answer(question: string, contexts: RagContextBlock[]): Promise<string> {
    return this.runWithLlmLimit(() => this.executeAnswer(question, contexts));
  }

  private async executeAnswer(question: string, contexts: RagContextBlock[]): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    const bodies = contexts.map((c) => c.content);
    if (!apiKey) {
      return `LLM API 키가 설정되지 않았습니다. 검색된 컨텍스트:\n\n${bodies.slice(0, 3).join('\n\n---\n\n')}`;
    }

    const maxCtx = Math.min(
      Math.max(1, Number(process.env.RAG_PROMPT_MAX_CONTEXTS ?? 8)),
      12,
    );
    const sliced = contexts.slice(0, maxCtx);
    const contextSection = this.formatGroundedContextSection(sliced);

    const prompt = [
      'You are a careful assistant for retrieval-grounded (RAG) answers.',
      'Rules:',
      '- Use ONLY the numbered context excerpts below. Every substantive claim must be supported there; add inline citations like [1] or [2][3] immediately after the sentence or clause they support.',
      '- If an excerpt is irrelevant, ignore it. If none of the excerpts answer the question, say clearly that the provided materials are insufficient — do not guess or use outside knowledge for document-specific facts.',
      '- Do not invent names, dates, figures, or policies that are not stated in the excerpts.',
      '- Write in Markdown: ## for section titles, short paragraphs, bullet lists when listing facts, **bold** for names, numbers, and key terms.',
      '',
      `Question: ${question}`,
      '',
      'Context excerpts (citation numbers refer to these blocks):',
      contextSection,
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
              bodies,
              `LLM transport error: ${transportError}`,
            );
          }
          return this.buildExtractiveFallbackAnswer(
            question,
            bodies,
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
          bodies,
          'LLM empty output',
        );
      }

      const shouldRetry = response.status === 429 || response.status >= 500;
      if (!shouldRetry || attempt === maxAttempts) {
        return this.buildExtractiveFallbackAnswer(
          question,
          bodies,
          `LLM failed ${response.status}`,
        );
      }

      await this.sleep(retryBaseMs * attempt);
    }

    return this.buildExtractiveFallbackAnswer(
      question,
      bodies,
      'LLM retry exhausted',
    );
  }

  private formatGroundedContextSection(blocks: RagContextBlock[]): string {
    return blocks
      .map((block, i) => {
        const n = i + 1;
        const meta = block.metadata ?? {};
        const title = meta.title != null ? String(meta.title).trim() : '';
        const page = meta.page;
        const pageStr =
          typeof page === 'number' && Number.isFinite(page) ? `p.${page}` : '';
        const docId = meta.documentId != null ? String(meta.documentId).trim() : '';
        const parts = [`[${n}]`];
        if (title) parts.push(`title="${title.replace(/"/g, '\\"')}"`);
        if (pageStr) parts.push(`page=${pageStr}`);
        if (docId) parts.push(`documentId=${docId}`);
        const header = parts.join(' ');
        const body = (block.content ?? '').trim();
        return `${header}\n${body}`;
      })
      .join('\n\n---\n\n');
  }

  async answerGeneral(question: string): Promise<string> {
    return this.runWithLlmLimit(() => this.executeAnswerGeneral(question));
  }

  /**
   * Vision caption + tags for RAG when OCR probe finds little text (scene/photo).
   * Uses Chat Completions + image_url (OpenAI-compatible).
   */
  async describeImageForRag(imagePath: string, mimeType: string): Promise<string> {
    return this.runWithLlmLimit(() => this.executeDescribeImageForRag(imagePath, mimeType));
  }

  /**
   * Text-only fusion of OCR / Vision / layout channels for image RAG indexing.
   * Deduplicates noise and produces one chunk-friendly document string.
   */
  async fuseImageRagChannels(input: {
    kind: string;
    weights: { ocr: number; vision: number; layout: number };
    ocrText: string;
    visionText: string;
    layoutText: string;
  }): Promise<string> {
    return this.runWithLlmLimit(() => this.executeFuseImageRagChannels(input));
  }

  private async executeDescribeImageForRag(
    imagePath: string,
    mimeType: string,
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const buf = readFileSync(imagePath);
    const b64 = buf.toString('base64');
    const safeMime = mimeType.startsWith('image/') ? mimeType : 'image/png';
    const dataUrl = `data:${safeMime};base64,${b64}`;

    const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(
      /\/+$/,
      '',
    );
    const model = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini';
    const timeoutMs = Number(process.env.IMAGE_VISION_TIMEOUT_MS ?? 90_000);

    const instruction = [
      'You catalog images for semantic search (RAG).',
      'Describe the scene, objects, setting, and any visible text language.',
      'Return ONLY valid JSON (no markdown code fences) in this exact shape:',
      '{"caption":"one concise paragraph","tags":["keyword1","keyword2","up to 12 short tags"]}',
    ].join(' ');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 600,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: instruction },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'auto' } },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Vision API HTTP ${response.status}: ${errBody.slice(0, 400)}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content?.trim() ?? '';
      return this.formatVisionJsonForRag(raw);
    } finally {
      clearTimeout(timeout);
    }
  }

  private formatVisionJsonForRag(raw: string): string {
    let s = raw.trim();
    if (s.startsWith('```')) {
      s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    let parsed: { caption?: string; tags?: unknown };
    try {
      parsed = JSON.parse(s) as { caption?: string; tags?: unknown };
    } catch {
      return ['[이미지 Vision 요약 — JSON 파싱 실패]', s.slice(0, 4000)].join('\n\n');
    }

    const caption = typeof parsed.caption === 'string' ? parsed.caption.trim() : '';
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const tagLine = tags.length ? tags.join(', ') : '';
    const searchLine = [caption, tagLine].filter(Boolean).join(' · ');

    return [
      '[이미지 유형: scene/photo — Vision 요약]',
      '',
      `Caption: ${caption || '(none)'}`,
      tagLine ? `Tags: ${tagLine}` : '',
      '',
      `[검색용 요약] ${searchLine || '(empty)'}`,
    ]
      .join('\n')
      .trim();
  }

  private async executeFuseImageRagChannels(input: {
    kind: string;
    weights: { ocr: number; vision: number; layout: number };
    ocrText: string;
    visionText: string;
    layoutText: string;
  }): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { kind, weights, ocrText, visionText, layoutText } = input;
    const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(
      /\/+$/,
      '',
    );
    const model =
      process.env.OPENAI_IMAGE_FUSE_MODEL ??
      process.env.OPENAI_MODEL ??
      process.env.OPENAI_VISION_MODEL ??
      'gpt-4o-mini';

    const maxO = Number(process.env.IMAGE_PIPELINE_FUSE_MAX_OCR ?? 8000);
    const maxV = Number(process.env.IMAGE_PIPELINE_FUSE_MAX_VISION ?? 5000);
    const maxL = Number(process.env.IMAGE_PIPELINE_FUSE_MAX_LAYOUT ?? 4000);
    const mo = Number.isFinite(maxO) && maxO > 400 ? Math.floor(maxO) : 8000;
    const mv = Number.isFinite(maxV) && maxV > 400 ? Math.floor(maxV) : 5000;
    const ml = Number.isFinite(maxL) && maxL > 400 ? Math.floor(maxL) : 4000;

    const bundle = [
      `Image class: ${kind}`,
      `Channel weights (trust): OCR=${weights.ocr.toFixed(3)}, Vision=${weights.vision.toFixed(3)}, Layout=${weights.layout.toFixed(3)}`,
      '',
      '--- OCR channel ---',
      ocrText.slice(0, mo),
      '',
      '--- Vision channel ---',
      visionText.slice(0, mv),
      '',
      '--- Layout channel ---',
      layoutText.slice(0, ml),
    ].join('\n');

    const system = [
      'You merge three text channels from the same raster image into ONE clean document for vector RAG.',
      'Trust OCR for exact strings when legible; use Vision for scene, handwriting, and text OCR missed;',
      'use Layout for line order and menus/tables.',
      'Deduplicate; drop obvious OCR noise; keep numbers, prices, dates, names, emails, URLs.',
      'Output plain text: short paragraphs; use bullet lines where helpful. Match the dominant language of the content.',
    ].join(' ');

    const controller = new AbortController();
    const timeoutMs = Number(process.env.IMAGE_PIPELINE_FUSE_TIMEOUT_MS ?? 45_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 2800,
          temperature: 0.15,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: bundle },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Image fuse HTTP ${response.status}: ${errBody.slice(0, 400)}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim() ?? '';
      if (!text) {
        throw new Error('Image fuse empty content');
      }
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async executeAnswerGeneral(question: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return 'LLM API 키가 설정되지 않아 일반 지식 답변을 생성할 수 없습니다.';
    }

    const prompt = [
      'You are a helpful assistant.',
      'Answer the question directly based on general knowledge. If uncertain, state uncertainty briefly.',
      'Write in Markdown: use ## section titles, bullet lists when helpful, and **bold** for important names or figures.',
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
