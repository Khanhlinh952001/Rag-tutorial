import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

interface PgVectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

@Injectable()
export class PgVectorService {
  private readonly tableName =
    process.env.PGVECTOR_TABLE && this.isValidIdentifier(process.env.PGVECTOR_TABLE)
      ? process.env.PGVECTOR_TABLE
      : 'document_vectors';

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async ensureCollection(vectorSize: number): Promise<void> {
    await this.prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        embedding vector(${vectorSize}) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async upsert(points: PgVectorPoint[]): Promise<void> {
    for (const point of points) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO ${this.tableName} (id, embedding, payload, updated_at)
         VALUES ($1, $2::vector, $3::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         payload = EXCLUDED.payload,
         updated_at = NOW();`,
        point.id,
        this.toVectorLiteral(point.vector),
        JSON.stringify(point.payload),
      );
    }
  }

  async search(
    queryVector: number[],
    limit = 5,
    documentId?: string,
  ): Promise<Array<{ id: string; payload: unknown; score: number }>> {
    if (documentId) {
      return this.prisma.$queryRawUnsafe<
        Array<{ id: string; payload: unknown; score: number }>
      >(
        `SELECT id, payload, 1 - (embedding <=> $1::vector) AS score
         FROM ${this.tableName}
         WHERE payload->>'documentId' = $3
         ORDER BY embedding <=> $1::vector
         LIMIT $2;`,
        this.toVectorLiteral(queryVector),
        limit,
        documentId,
      );
    }

    return this.prisma.$queryRawUnsafe<
      Array<{ id: string; payload: unknown; score: number }>
    >(
      `SELECT id, payload, 1 - (embedding <=> $1::vector) AS score
       FROM ${this.tableName}
       ORDER BY embedding <=> $1::vector
       LIMIT $2;`,
      this.toVectorLiteral(queryVector),
      limit,
    );
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM ${this.tableName} WHERE payload->>'documentId' = $1;`,
      documentId,
    );
  }

  private toVectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }

  private isValidIdentifier(value: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
  }
}
