import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CreateVectorDto } from './dto/create-vector.dto';
import { UpdateVectorDto } from './dto/update-vector.dto';
import { EmbeddingService } from './embeddings/embedding.service';
import { QdrantService } from './qdrant.service';
import { PgVectorService } from './pgvector/pgvector.service';

/** Qdrant only accepts point ids as unsigned int or UUID; Prisma `cuid` strings cause HTTP 400. */
function stablePointUuid(documentId: string, chunkIndex: number): string {
  const digest = createHash('sha256')
    .update(`chunk:${documentId}:${chunkIndex}`)
    .digest();
  const buf = Buffer.from(digest.subarray(0, 16));
  buf[6] = (buf[6]! & 0x0f) | 0x40;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const h = buf.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export interface ChunkForIndexing {
  index: number;
  content: string;
  metadata?: {
    page?: number | null;
    documentId?: string;
    source?: string;
    title?: string;
  };
}

export interface IndexDocumentInput {
  documentId: string;
  mimeType: string;
  source: string;
  chunks: ChunkForIndexing[];
}

@Injectable()
export class VectorService {
  private readonly vectorStore = (process.env.VECTOR_STORE ?? 'pgvector').toLowerCase();

  constructor(
    @Inject(EmbeddingService)
    private readonly embeddingService: EmbeddingService,
    @Inject(PgVectorService)
    private readonly pgVectorService: PgVectorService,
    @Inject(QdrantService)
    private readonly qdrantService: QdrantService,
  ) {}

  async indexDocumentChunks(
    input: IndexDocumentInput,
  ): Promise<{ indexed: number; store: string; vectorIds: string[] }> {
    if (input.chunks.length === 0) {
      return { indexed: 0, store: this.vectorStore, vectorIds: [] };
    }

    const vectors = await this.embeddingService.embedTexts(
      input.chunks.map((chunk) => chunk.content),
    );

    const backend =
      this.vectorStore === 'qdrant' ? this.qdrantService : this.pgVectorService;
    await backend.ensureCollection(this.embeddingService.vectorSize);

    const points = input.chunks.map((chunk, i) => ({
        id: stablePointUuid(input.documentId, chunk.index),
        vector: vectors[i],
        payload: {
          documentId: input.documentId,
          chunkIndex: chunk.index,
          mimeType: input.mimeType,
          source: input.source,
          page: chunk.metadata?.page ?? null,
          text: chunk.content,
          ...(chunk.metadata ?? {}),
        },
      }));
    await backend.upsert(points);

    return {
      indexed: input.chunks.length,
      store: this.vectorStore,
      vectorIds: points.map((point) => point.id),
    };
  }

  async deleteDocumentVectors(documentId: string): Promise<void> {
    const backend =
      this.vectorStore === 'qdrant' ? this.qdrantService : this.pgVectorService;
    await backend.deleteByDocumentId(documentId);
  }

  create(createVectorDto: CreateVectorDto) {
    return 'This action adds a new vector';
  }

  findAll() {
    return `This action returns all vector`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vector`;
  }

  update(id: number, updateVectorDto: UpdateVectorDto) {
    return `This action updates a #${id} vector`;
  }

  remove(id: number) {
    return `This action removes a #${id} vector`;
  }
}
