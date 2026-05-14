import { Injectable } from '@nestjs/common';

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

interface QdrantSearchResult {
  score?: number;
  payload?: Record<string, unknown>;
}

function parseVectorSizeFromCollectionGet(json: unknown): number | null {
  if (!json || typeof json !== "object") return null;
  const result = (json as { result?: unknown }).result;
  if (!result || typeof result !== "object") return null;
  const config = (result as { config?: unknown }).config;
  if (!config || typeof config !== "object") return null;
  const params = (config as { params?: unknown }).params;
  if (!params || typeof params !== "object") return null;
  const vectors = (params as { vectors?: unknown }).vectors;
  if (!vectors || typeof vectors !== "object") return null;

  const asRecord = vectors as Record<string, unknown>;
  if (typeof asRecord.size === "number") {
    return asRecord.size;
  }

  for (const v of Object.values(asRecord)) {
    if (v && typeof v === "object" && typeof (v as { size?: unknown }).size === "number") {
      return (v as { size: number }).size;
    }
  }
  return null;
}

@Injectable()
export class QdrantService {
  private readonly qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  private readonly collectionName = process.env.QDRANT_COLLECTION ?? 'document_chunks';

  async ensureCollection(vectorSize: number): Promise<void> {
    await this.ensureCollectionInner(vectorSize, 0);
  }

  private async ensureCollectionInner(vectorSize: number, depth: number): Promise<void> {
    if (depth > 4) {
      throw new Error("Qdrant ensure collection: too many retries (409/conflict).");
    }
    const base = `${this.qdrantUrl}/collections/${this.collectionName}`;
    const getRes = await fetch(base);

    if (getRes.ok) {
      const json: unknown = await getRes.json().catch(() => null);
      const existing = parseVectorSizeFromCollectionGet(json);
      if (existing != null && existing !== vectorSize) {
        throw new Error(
          `Qdrant collection "${this.collectionName}" exists with vector size ${existing}; app expects ${vectorSize}. Delete or rename the collection in Qdrant, or align embedding dimensions.`,
        );
      }
      return;
    }

    if (getRes.status !== 404) {
      throw new Error(`Qdrant get collection failed: ${getRes.status}`);
    }

    const putRes = await fetch(base, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance: "Cosine",
        },
      }),
    });

    if (putRes.ok) {
      return;
    }

    if (putRes.status === 409) {
      await this.ensureCollectionInner(vectorSize, depth + 1);
      return;
    }

    throw new Error(`Qdrant ensure collection failed: ${putRes.status}`);
  }

  async upsert(points: QdrantPoint[]): Promise<void> {
    const response = await fetch(
      `${this.qdrantUrl}/collections/${this.collectionName}/points?wait=true`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ points }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const snippet = detail.length > 280 ? `${detail.slice(0, 280)}…` : detail;
      throw new Error(
        `Qdrant upsert failed: ${response.status}${snippet ? ` — ${snippet}` : ''}`,
      );
    }
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const response = await fetch(
      `${this.qdrantUrl}/collections/${this.collectionName}/points/delete?wait=true`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [
              {
                key: 'documentId',
                match: { value: documentId },
              },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Qdrant delete failed: ${response.status}`);
    }
  }

  async search(
    queryVector: number[],
    limit = 5,
    documentId?: string,
  ): Promise<QdrantSearchResult[]> {
    const filter = documentId
      ? {
          must: [
            {
              key: 'documentId',
              match: { value: documentId },
            },
          ],
        }
      : undefined;

    const response = await fetch(
      `${this.qdrantUrl}/collections/${this.collectionName}/points/search`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vector: queryVector,
          limit,
          with_payload: true,
          filter,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Qdrant search failed: ${response.status}`);
    }
    const json = (await response.json()) as {
      result?: QdrantSearchResult[];
    };
    return json.result ?? [];
  }
}
