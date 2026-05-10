import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const DOCUMENT_INGEST_QUEUE = 'document-ingest';

@Injectable()
export class QueuesService {
  private readonly queue = new Queue(DOCUMENT_INGEST_QUEUE, {
    connection: {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  });

  async enqueueDocument(documentId: string) {
    await this.queue.add(
      'process-document',
      { documentId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }

  async stats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

 
}
