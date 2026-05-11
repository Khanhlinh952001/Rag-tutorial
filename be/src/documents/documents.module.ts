import { Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { DocumentTextExtractorService } from "./extractors/document-text-extractor.service";
import { ImageIngestService } from "./image-ingest.service";
import { VectorModule } from "../vector/vector.module";
import { PrismaService } from "../prisma.service";
import { QueuesModule } from "../queues/queues.module";
import { LlmModule } from "../llm/llm.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [VectorModule, QueuesModule, LlmModule, AuthModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentTextExtractorService,
    ImageIngestService,
    PrismaService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
