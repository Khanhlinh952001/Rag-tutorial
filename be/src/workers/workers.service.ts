import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { DocumentsService } from "../documents/documents.service";
import { PrismaService } from "../prisma.service";
import { DocumentStatus } from "../generated/prisma/enums";
import { DOCUMENT_INGEST_QUEUE } from "../queues/queues.service";

@Injectable()
export class WorkersService implements OnModuleInit, OnModuleDestroy {
  private queueWorker?: Worker;

  constructor(
    @Inject(DocumentsService)
    private readonly documentsService: DocumentsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.queueWorker = new Worker(
      DOCUMENT_INGEST_QUEUE,
      async (job) => {
        if (job.name !== "process-document") {
          return;
        }
        const data = job.data as { documentId?: string };
        if (!data.documentId) {
          return;
        }
        await this.documentsService.processDocument(data.documentId);
      },
      {
        connection: {
          host: process.env.REDIS_HOST ?? "127.0.0.1",
          port: Number(process.env.REDIS_PORT ?? 6379),
        },
      },
    );
  }

  async onModuleDestroy() {
    await this.queueWorker?.close();
  }

  async processDocument(documentId: string) {
    return this.documentsService.processDocument(documentId);
  }

  async processPending(limit = 10) {
    const pending = await this.prisma.document.findMany({
      where: { status: DocumentStatus.PENDING },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    const results: Array<{ documentId: string; ok: boolean; error?: string }> =
      [];
    for (const doc of pending) {
      try {
        await this.documentsService.processDocument(doc.id);
        results.push({ documentId: doc.id, ok: true });
      } catch (error) {
        results.push({
          documentId: doc.id,
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { processed: results.length, results };
  }
}
