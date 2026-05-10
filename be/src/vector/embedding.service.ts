import { Injectable } from '@nestjs/common';

@Injectable()
export class EmbeddingService {
  // Deterministic local embedding to keep the pipeline runnable without external API keys.
  // Replace this with OpenAI/Voyage/Cohere provider when needed.
  readonly vectorSize = 256;

  async embedTexts(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): number[] {
    const vector = new Array<number>(this.vectorSize).fill(0);
    const normalized = text.toLowerCase();

    for (let index = 0; index < normalized.length; index += 1) {
      const code = normalized.charCodeAt(index);
      const bucket = code % this.vectorSize;
      vector[bucket] += 1;
    }

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) {
      return vector;
    }

    return vector.map((value) => value / norm);
  }
}
