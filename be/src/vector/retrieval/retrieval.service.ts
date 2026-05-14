import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from '../embeddings/embedding.service';
import { PgVectorService } from '../pgvector/pgvector.service';
import { QdrantService } from '../qdrant.service';

type RetrievedItem = {
  content: string;
  score: number;
  metadata: Record<string, unknown>;
};

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
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

    const rerankProvider = (process.env.RERANKER_PROVIDER ?? '').toLowerCase().trim();
    const candidateK =
      rerankProvider === 'cohere'
        ? Math.max(
            topK * 3,
            Number(process.env.RERANK_COHERE_CANDIDATE_K ?? 24),
            topK,
          )
        : Math.max(topK * 3, topK);

    if (this.vectorStore === 'qdrant') {
      const points = await this.qdrantService.search(queryVector, candidateK, documentId);
      const mapped = points.map((item) => ({
        content: String(item.payload?.text ?? ''),
        score: Number(item.score ?? 0),
        metadata: (item.payload ?? {}) as Record<string, unknown>,
      }));
      return this.applyRerankAndThreshold(query, mapped, topK, scoreThreshold);
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
    return this.applyRerankAndThreshold(query, mapped, topK, scoreThreshold);
  }

  private async applyRerankAndThreshold(
    query: string,
    mapped: RetrievedItem[],
    topK: number,
    scoreThreshold: number,
  ): Promise<RetrievedItem[]> {
    const reranked = await this.rerankPipeline(query, mapped);
    return reranked.filter((item) => item.score >= scoreThreshold).slice(0, topK);
  }

  private async rerankPipeline(query: string, items: RetrievedItem[]): Promise<RetrievedItem[]> {
    const provider = (process.env.RERANKER_PROVIDER ?? '').toLowerCase().trim();
    if (provider === 'cohere' && items.length > 0) {
      return this.rerankCohereOrFallback(query, items);
    }
    return this.rerankHybrid(query, items);
  }

  private async rerankCohereOrFallback(query: string, items: RetrievedItem[]): Promise<RetrievedItem[]> {
    const apiKey = process.env.COHERE_API_KEY?.trim();
    if (!apiKey) {
      this.logger.warn('RERANKER_PROVIDER=cohere but COHERE_API_KEY is empty; using hybrid rerank');
      return this.rerankHybrid(query, items);
    }

    const maxChars = Number(process.env.RERANK_COHERE_MAX_DOC_CHARS ?? 16000);
    const cap = Number.isFinite(maxChars) && maxChars > 500 ? Math.floor(maxChars) : 16000;
    const documents = items.map((item) => item.content.slice(0, cap));

    const model =
      process.env.COHERE_RERANK_MODEL?.trim() || 'rerank-multilingual-v3.0';

    try {
      const res = await fetch('https://api.cohere.com/v1/rerank', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          query: query.slice(0, 8000),
          documents,
          top_n: documents.length,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        this.logger.warn(`Cohere rerank HTTP ${res.status}: ${err.slice(0, 200)}`);
        return this.rerankHybrid(query, items);
      }

      const json = (await res.json()) as {
        results?: Array<{ index?: number; relevance_score?: number }>;
      };
      const results = json.results;
      if (!Array.isArray(results) || results.length === 0) {
        return this.rerankHybrid(query, items);
      }

      const ordered: RetrievedItem[] = [];
      for (const row of results) {
        const idx = row.index;
        if (typeof idx !== 'number' || idx < 0 || idx >= items.length) continue;
        const rel = Number(row.relevance_score ?? 0);
        ordered.push({
          ...items[idx],
          score: Number.isFinite(rel) ? rel : items[idx].score,
        });
      }

      if (ordered.length === 0) {
        return this.rerankHybrid(query, items);
      }

      const mapScores = (process.env.RERANK_COHERE_MAP_TO_VECTOR_RANGE ?? 'true').toLowerCase() !== 'false';
      return mapScores ? this.mapCohereScoresToVectorRange(ordered) : ordered;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      this.logger.warn(`Cohere rerank failed: ${msg}`);
      return this.rerankHybrid(query, items);
    }
  }

  /**
   * Cohere relevance scores use a different scale than cosine similarity; min–max
   * map each batch into [lo, hi] so RETRIEVAL_SCORE_THRESHOLD stays meaningful.
   */
  private mapCohereScoresToVectorRange(items: RetrievedItem[]): RetrievedItem[] {
    if (items.length === 0) return items;
    const raw = items.map((i) => i.score);
    const min = Math.min(...raw);
    const max = Math.max(...raw);
    const spread = max - min;
    const lo = Number(process.env.RERANK_COHERE_SCORE_MAP_LO ?? 0.52);
    const hi = Number(process.env.RERANK_COHERE_SCORE_MAP_HI ?? 0.94);
    const safeLo = Number.isFinite(lo) ? lo : 0.52;
    const safeHi = Number.isFinite(hi) ? hi : 0.94;
    if (spread < 1e-9) {
      const mid = (safeLo + safeHi) / 2;
      return items.map((i) => ({ ...i, score: mid }));
    }
    return items.map((i) => ({
      ...i,
      score: safeLo + ((i.score - min) / spread) * (safeHi - safeLo),
    }));
  }

  private rerankHybrid(query: string, items: RetrievedItem[]) {
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
