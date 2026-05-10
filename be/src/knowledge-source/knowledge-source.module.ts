import { Module } from '@nestjs/common';
import { KnowledgeSourceController } from './knowledge-source.controller';
import { KnowledgeSourceService } from './knowledge-source.service';
import { PrismaService } from '../prisma.service';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [VectorModule],
  controllers: [KnowledgeSourceController],
  providers: [KnowledgeSourceService, PrismaService],
  exports: [KnowledgeSourceService],
})
export class KnowledgeSourceModule {}
