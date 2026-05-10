import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { PrismaService } from "./prisma.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { DocumentsModule } from './documents/documents.module';
import { UploadsModule } from './uploads/uploads.module';
import { VectorModule } from './vector/vector.module';
import { QueuesModule } from './queues/queues.module';
import { WorkersModule } from './workers/workers.module';
import { SharedModule } from './shared/shared.module';
import { LlmModule } from './llm/llm.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { AuthModule } from './auth/auth.module';
import { KnowledgeSourceModule } from './knowledge-source/knowledge-source.module';

function throttleInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

function throttleTtlMs(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : fallback;
}

const aiChatBurstLimit = throttleInt(process.env.AI_CHAT_THROTTLE_BURST_LIMIT, 10);
const aiChatBurstTtlMs = throttleTtlMs(process.env.AI_CHAT_THROTTLE_BURST_MS, 10_000);
const aiChatWindowLimit = throttleInt(process.env.AI_CHAT_THROTTLE_LIMIT, 45);
const aiChatWindowTtlMs = throttleTtlMs(process.env.AI_CHAT_THROTTLE_TTL_MS, 60_000);

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'aiChatBurst',
        ttl: aiChatBurstTtlMs,
        limit: aiChatBurstLimit,
      },
      {
        name: 'aiChatWindow',
        ttl: aiChatWindowTtlMs,
        limit: aiChatWindowLimit,
      },
    ]),
    DocumentsModule,
    UploadsModule,
    VectorModule,
    QueuesModule,
    WorkersModule,
    SharedModule,
    LlmModule,
    AiChatModule,
    AuthModule,
    KnowledgeSourceModule,
  ],
  controllers: [
    AppController,
    UsersController
  ],
  providers: [
    PrismaService,
    UsersService
  ],
})
export class AppModule {}
