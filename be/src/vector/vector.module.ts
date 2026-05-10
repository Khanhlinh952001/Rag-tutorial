import { Module } from '@nestjs/common';
import { VectorService } from './vector.service';
import { VectorController } from './vector.controller';
import { EmbeddingService } from './embeddings/embedding.service';
import { QdrantService } from './qdrant.service';
import { PgVectorService } from './pgvector/pgvector.service';
import { PrismaService } from '../prisma.service';
import { RetrievalService } from './retrieval/retrieval.service';
import { ChunkingService } from './chunking/chunking.service';

@Module({
  controllers: [VectorController],
  providers: [
    VectorService,
    EmbeddingService,
    PgVectorService,
    QdrantService,
    RetrievalService,
    ChunkingService,
    PrismaService,
  ],
  exports: [VectorService, EmbeddingService, RetrievalService],
})
export class VectorModule {}
