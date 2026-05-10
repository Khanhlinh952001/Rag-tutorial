import { Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { DocumentTextExtractorService } from "./extractors/document-text-extractor.service";
import { VectorModule } from "../vector/vector.module";
import { PrismaService } from "../prisma.service";
import { QueuesModule } from "../queues/queues.module";

@Module({
  imports: [VectorModule, QueuesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentTextExtractorService, PrismaService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
