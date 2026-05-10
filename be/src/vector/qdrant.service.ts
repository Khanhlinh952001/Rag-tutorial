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

@Injectable()
export class QdrantService {
  private readonly qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  private readonly collectionName = process.env.QDRANT_COLLECTION ?? 'document_chunks';

  async ensureCollection(vectorSize: number): Promise<void> {
    const response = await fetch(
      `${this.qdrantUrl}/collections/${this.collectionName}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Qdrant ensure collection failed: ${response.status}`);
    }
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
      throw new Error(`Qdrant upsert failed: ${response.status}`);
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
