import { Module } from "@nestjs/common";
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

@Module({
  imports: [
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
