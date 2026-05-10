import { Module } from '@nestjs/common';
import { WorkersService } from './workers.service';
import { WorkersController } from './workers.controller';
import { DocumentsModule } from '../documents/documents.module';
import { PrismaService } from '../prisma.service';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [DocumentsModule, QueuesModule],
  controllers: [WorkersController],
  providers: [WorkersService, PrismaService],
})
export class WorkersModule {}
