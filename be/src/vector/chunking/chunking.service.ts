import { Injectable } from '@nestjs/common';

@Injectable()
export class ChunkingService {
  getDefaultConfig() {
    return {
      strategy: process.env.CHUNKING_STRATEGY ?? 'semantic',
      semanticBreakThreshold: Number(process.env.SEMANTIC_BREAK_THRESHOLD ?? 0.72),
    };
  }
}
