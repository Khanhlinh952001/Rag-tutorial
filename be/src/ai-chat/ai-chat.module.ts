import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { VectorModule } from '../vector/vector.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaService } from '../prisma.service';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [VectorModule, LlmModule, DocumentsModule],
  controllers: [AiChatController],
  providers: [AiChatService, PrismaService],
})
export class AiChatModule {}
