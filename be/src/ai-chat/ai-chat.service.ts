import { Inject, Injectable, Logger } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
import { RetrievalService } from '../vector/retrieval/retrieval.service';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma.service';
import { MessageRole } from '../generated/prisma/enums';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    @Inject(RetrievalService)
    private readonly retrievalService: RetrievalService,
    @Inject(LlmService)
    private readonly llmService: LlmService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(DocumentsService)
    private readonly documentsService: DocumentsService,
  ) {}

  async ask(
    userId: string,
    question: string,
    conversationId?: string,
    topK = 5,
    documentId?: string,
    scoreThreshold?: number,
  ) {
    const urlIngest = await this.tryIngestUrlOnlyMessage(userId, question);
    const retrievalDocumentId = documentId ?? urlIngest.documentId;
    const retrievalQuery =
      urlIngest.textPreviewForRetrieval?.trim() ||
      question;

    const retrieval = await this.retrieveForQuestion(
      retrievalQuery,
      topK,
      retrievalDocumentId,
      scoreThreshold,
    );
    let relevantRetrieved = this.filterRelevantRetrieved(
      question,
      retrieval.retrieved,
    );
    if (
      urlIngest.documentId &&
      relevantRetrieved.length === 0 &&
      retrieval.retrieved.length > 0
    ) {
      relevantRetrieved = retrieval.retrieved.slice(0, topK);
    }

    let answer =
      relevantRetrieved.length > 0
        ? await this.llmService.answer(
            urlIngest.urlOnly
              ? `사용자가 웹 페이지 URL만 입력했습니다. 아래 컨텍스트만 근거로 이 페이지의 핵심을 요약·설명하세요. (원문: ${question})`
              : question,
            relevantRetrieved.map((r) => r.content),
          )
        : await this.llmService.answerGeneral(question);

    if (urlIngest.ingested) {
      const notice = `**웹 페이지를 학습 DB에 추가했습니다.** \`${urlIngest.url}\`\n\n`;
      answer = notice + answer;
    } else if (urlIngest.error) {
      const warn = `> 페이지 수집 실패: ${urlIngest.error}\n\n---\n\n`;
      answer = warn + answer;
    }

    const conversation =
      conversationId != null
        ? await this.prisma.conversation.findFirst({
            where: { id: conversationId, userId },
          })
        : null;
    const ensuredConversation =
      conversation ??
      (await this.prisma.conversation.create({
        data: {
          userId,
          title: question.slice(0, 120),
        },
      }));

    await this.prisma.message.create({
      data: {
        conversationId: ensuredConversation.id,
        role: MessageRole.USER,
        content: question,
      },
    });
    await this.prisma.message.create({
      data: {
        conversationId: ensuredConversation.id,
        role: MessageRole.ASSISTANT,
        content: answer,
        metadata: JSON.parse(
          JSON.stringify({
            retrieved: relevantRetrieved,
            filteredOutCount: retrieval.retrieved.length - relevantRetrieved.length,
            noContextFallback: relevantRetrieved.length === 0,
            urlIngest: urlIngest.ingested
              ? { url: urlIngest.url, documentId: urlIngest.documentId }
              : urlIngest.error
                ? { error: urlIngest.error, url: urlIngest.url }
                : undefined,
          }),
        ) as Prisma.InputJsonValue,
      },
    });

    return {
      conversationId: ensuredConversation.id,
      answer,
      retrieved: relevantRetrieved,
      appliedScoreThreshold: retrieval.appliedScoreThreshold,
      urlIngest:
        urlIngest.ingested || urlIngest.error
          ? {
              ingested: urlIngest.ingested,
              url: urlIngest.url,
              documentId: urlIngest.documentId,
              error: urlIngest.error,
            }
          : undefined,
    };
  }

  /**
   * 한 줄로 붙여넣은 http(s) URL만 웹 문서로 수집·색인 (관리자 웹 ingest와 동일 파이프라인).
   */
  private async tryIngestUrlOnlyMessage(
    userId: string,
    question: string,
  ): Promise<{
    urlOnly: boolean;
    ingested: boolean;
    documentId?: string;
    url: string;
    textPreviewForRetrieval?: string;
    error?: string;
  }> {
    const url = this.extractSingleHttpUrl(question);
    if (!url) {
      return { urlOnly: false, ingested: false, url: '' };
    }

    try {
      const result = await this.documentsService.ingestFromWeb({
        url,
        uploadedById: userId,
      });
      return {
        urlOnly: true,
        ingested: true,
        documentId: result.documentId,
        url,
        textPreviewForRetrieval:
          typeof result.textPreview === 'string'
            ? result.textPreview
            : undefined,
      };
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'ingest failed';
      this.logger.warn(`URL ingest from chat failed: ${message}`);
      return {
        urlOnly: true,
        ingested: false,
        url,
        error: message,
      };
    }
  }

  /** 메시지 전체가 단일 http(s) URL 한 줄일 때만 URL을 반환 */
  private extractSingleHttpUrl(text: string): string | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const unwrapped = trimmed.replace(/^<([^>]+)>$/u, '$1').trim();
    const lines = unwrapped
      .split(/\r?\n/u)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length !== 1) return null;

    let candidate = lines[0];
    candidate = candidate.replace(/[.,;)\]}>"']+$/u, '');
    if (!/^https?:\/\//iu.test(candidate)) return null;

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.href;
    } catch {
      return null;
    }
  }

  async search(
    question: string,
    topK = 5,
    documentId?: string,
    scoreThreshold?: number,
  ) {
    const retrieval = await this.retrieveForQuestion(
      question,
      topK,
      documentId,
      scoreThreshold,
    );
    return {
      query: question,
      topK,
      documentId: documentId ?? null,
      scoreThreshold: scoreThreshold ?? null,
      appliedScoreThreshold: retrieval.appliedScoreThreshold,
      total: retrieval.retrieved.length,
      results: retrieval.retrieved,
    };
  }

  async listMyConversations(userId: string, limit = 20) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getMyConversationDetail(userId: string, conversationId: string) {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async deleteMyConversation(userId: string, conversationId: string) {
    return this.prisma.conversation.deleteMany({
      where: { id: conversationId, userId },
    });
  }

  private async retrieveForQuestion(
    question: string,
    topK: number,
    documentId?: string,
    scoreThreshold?: number,
  ) {
    const appliedScoreThreshold = this.retrievalService.resolveScoreThreshold(
      question,
      scoreThreshold,
    );
    let retrieved = await this.retrievalService
      .retrieve(question, topK, {
        documentId,
        scoreThreshold: appliedScoreThreshold,
      })
      .catch(() => []);

    if (retrieved.length === 0) {
      retrieved = await this.retrieveFromDbChunks(question, topK, documentId);
    }

    return {
      appliedScoreThreshold,
      retrieved,
    };
  }

  private async retrieveFromDbChunks(question: string, topK: number, documentId?: string) {
    const queryTokens = this.tokenize(question);
    const selectedTokens = queryTokens.slice(0, 8);

    const chunks = await this.prisma.documentChunk.findMany({
      where: {
        document: {
          status: 'COMPLETED',
          ...(documentId ? { id: documentId } : {}),
        },
        ...(selectedTokens.length > 0
          ? {
              OR: selectedTokens.map((token) => ({
                content: { contains: token, mode: 'insensitive' as const },
              })),
            }
          : {}),
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            filePath: true,
          },
        },
      },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });

    const scored = chunks
      .map((chunk) => {
        const contentTokens = new Set(this.tokenize(chunk.content));
        const matched = queryTokens.filter((token) => contentTokens.has(token)).length;
        const score = queryTokens.length > 0 ? matched / queryTokens.length : 0;
        return {
          content: chunk.content,
          score,
          metadata: {
            sourceType: 'db-fallback',
            documentId: chunk.document.id,
            title: chunk.document.title,
            source: chunk.document.filePath,
            chunkIndex: chunk.chunkIndex,
          } as Record<string, unknown>,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }

  private filterRelevantRetrieved(
    question: string,
    retrieved: Array<{ content: string; score: number; metadata: Record<string, unknown> }>,
  ) {
    const queryTokens = this.tokenize(question);
    if (queryTokens.length === 0) return retrieved;

    const minOverlap = Number(process.env.ASK_MIN_KEYWORD_OVERLAP ?? 0.3);
    const minMatchedTokens = Number(process.env.ASK_MIN_MATCHED_TOKENS ?? 2);

    return retrieved.filter((item) => {
      const contentTokens = new Set(this.tokenize(item.content));
      const matched = queryTokens.filter((token) => contentTokens.has(token)).length;
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
