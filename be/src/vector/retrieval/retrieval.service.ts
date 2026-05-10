import { Inject, Injectable } from '@nestjs/common';
import { EmbeddingService } from '../embeddings/embedding.service';
import { PgVectorService } from '../pgvector/pgvector.service';
import { QdrantService } from '../qdrant.service';

@Injectable()
export class RetrievalService {
  private readonly vectorStore = (process.env.VECTOR_STORE ?? 'pgvector').toLowerCase();

  constructor(
    @Inject(EmbeddingService)
    private readonly embeddingService: EmbeddingService,
    @Inject(PgVectorService)
    private readonly pgVectorService: PgVectorService,
    @Inject(QdrantService)
    private readonly qdrantService: QdrantService,
  ) {}

  async retrieve(
    query: string,
    topK = 5,
    options?: { documentId?: string; scoreThreshold?: number },
  ): Promise<Array<{ content: string; score: number; metadata: Record<string, unknown> }>> {
    const [queryVector] = await this.embeddingService.embedTexts([query]);
    const documentId = options?.documentId;
    const scoreThreshold = this.resolveScoreThreshold(query, options?.scoreThreshold);

    const candidateK = Math.max(topK * 3, topK);

    if (this.vectorStore === 'qdrant') {
      const points = await this.qdrantService.search(queryVector, candidateK, documentId);
      const mapped = points.map((item) => ({
        content: String(item.payload?.text ?? ''),
        score: Number(item.score ?? 0),
        metadata: (item.payload ?? {}) as Record<string, unknown>,
      }));
      return this.rerankHybrid(query, mapped)
        .filter((item) => item.score >= scoreThreshold)
        .slice(0, topK);
    }

    const rows = await this.pgVectorService.search(queryVector, candidateK, documentId);
    const mapped = rows.map((item) => {
      const payload = (item.payload ?? {}) as Record<string, unknown>;
      return {
        content: String(payload.text ?? ''),
        score: Number(item.score ?? 0),
        metadata: payload,
      };
    });
    return this.rerankHybrid(query, mapped)
      .filter((item) => item.score >= scoreThreshold)
      .slice(0, topK);
  }

  private rerankHybrid(
    query: string,
    items: Array<{ content: string; score: number; metadata: Record<string, unknown> }>,
  ) {
    const queryTokens = this.tokenize(query);
    return items
      .map((item) => {
        const contentTokens = this.tokenize(item.content);
        const overlap = this.keywordOverlap(queryTokens, contentTokens);
        const hybridWeight = Number(process.env.HYBRID_KEYWORD_WEIGHT ?? 0.2);
        return {
          ...item,
          score: item.score * (1 - hybridWeight) + overlap * hybridWeight,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  private keywordOverlap(queryTokens: string[], contentTokens: string[]): number {
    if (queryTokens.length === 0) {
      return 0;
    }
    const contentSet = new Set(contentTokens);
    const matched = queryTokens.filter((token) => contentSet.has(token)).length;
    return matched / queryTokens.length;
  }

  private getAutoScoreThreshold(query: string): number {
    const defaultThreshold = Number(process.env.RETRIEVAL_SCORE_THRESHOLD ?? 0);
    const koreanThreshold = Number(process.env.RETRIEVAL_SCORE_THRESHOLD_KO ?? 0.45);

    // Lower threshold for Korean queries because score distribution is typically lower.
    if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(query)) {
      return koreanThreshold;
    }

    return defaultThreshold;
  }

  resolveScoreThreshold(query: string, requestedThreshold?: number): number {
    if (requestedThreshold != null) {
      return requestedThreshold;
    }
    return this.getAutoScoreThreshold(query);
  }
}
