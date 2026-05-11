import { Inject, Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { EmbeddingService } from '../../vector/embeddings/embedding.service';
import { extractDocxText } from './docx.extractor';
import { extractHwpText } from './hwp.extractor';
import { extractImageText } from './image.extractor';
import { extractPdfText } from './pdf.extractor';
import { extractPptxText } from './pptx.extractor';
import { extractJsonText } from './json.extractor';
import { extractTxtText } from './txt.extractor';
import { extractXlsxText } from './xlsx.extractor';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PPT_MIME = 'application/vnd.ms-powerpoint';
const HWP_MIME = 'application/x-hwp';
const HWPX_MIME = 'application/haansofthwp';
const TXT_MIME = 'text/plain';
const JSON_MIME = 'application/json';
const JSON_LD_MIME = 'application/ld+json';
const TEXT_JSON_MIME = 'text/json';
const PDF_MIME = 'application/pdf';
const JPG_MIME = 'image/jpeg';
const PNG_MIME = 'image/png';
const WEBP_MIME = 'image/webp';
const GIF_MIME = 'image/gif';

export interface TextChunk {
  index: number;
  content: string;
  metadata: {
    page: number | null;
  };
}

@Injectable()
export class DocumentTextExtractorService {
  constructor(
    @Inject(EmbeddingService)
    private readonly embeddingService: EmbeddingService,
  ) {}

  async extractByMimeType(filePath: string, mimeType: string): Promise<string> {
    switch (mimeType) {
      case PDF_MIME:
        return extractPdfText(filePath);
      case DOCX_MIME:
        return extractDocxText(filePath);
      case XLSX_MIME:
        return extractXlsxText(filePath);
      case PPTX_MIME:
      case PPT_MIME:
        return extractPptxText(filePath);
      case HWP_MIME:
      case HWPX_MIME:
        return extractHwpText(filePath);
      case TXT_MIME:
        return extractTxtText(filePath);
      case JSON_MIME:
      case JSON_LD_MIME:
      case TEXT_JSON_MIME:
        return extractJsonText(filePath);
      case JPG_MIME:
      case PNG_MIME:
      case WEBP_MIME:
      case GIF_MIME:
        return extractImageText(filePath);
      default:
        throw new Error(`Unsupported file mime type: ${mimeType}`);
    }
  }

  cleanExtractedText(text: string, mimeType: string): string {
    let cleaned = text;

    if (mimeType === PDF_MIME) {
      cleaned = cleaned
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
        .replace(/^\s*page\s+\d+\s*$/gim, '')
        .replace(/^\s*\d+\s*$/gim, '');
    }

    cleaned = cleaned
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    return cleaned;
  }

  splitIntoChunks(
    text: string,
    mimeType: string,
    chunkSize = Number(process.env.CHUNK_SIZE ?? 1000),
    chunkOverlap = Number(process.env.CHUNK_OVERLAP ?? 200),
  ): Promise<TextChunk[]> {
    if (!text.trim()) {
      return Promise.resolve([]);
    }

    const strategy = (process.env.CHUNKING_STRATEGY ?? 'recursive').toLowerCase();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });

    const pages =
      mimeType === PDF_MIME
        ? text.split('\f').map((pageText, i) => ({ text: pageText, page: i + 1 }))
        : [{ text, page: null as number | null }];

    const chunks: TextChunk[] = [];
    const jobs = pages.map(async (pageInfo) => {
      if (strategy === 'semantic') {
        return this.semanticSplit(pageInfo.text.trim(), pageInfo.page, chunkSize);
      }
      const split = await splitter.splitText(pageInfo.text.trim());
      return split
        .map((content: string) => content.trim())
        .filter(Boolean)
        .map((content: string) => ({ content, page: pageInfo.page }));
    });

    return Promise.all(jobs).then((all) => {
      all.flat().forEach((entry: { content: string; page: number | null }) => {
        chunks.push({
          index: chunks.length,
          content: entry.content,
          metadata: { page: entry.page },
        });
      });
      return chunks;
    });
  }

  private async semanticSplit(
    text: string,
    page: number | null,
    chunkSize: number,
  ): Promise<Array<{ content: string; page: number | null }>> {
    const sentences = text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length <= 1) {
      return sentences.map((content) => ({ content, page }));
    }

    const vectors = await this.embeddingService.embedTexts(sentences);
    const threshold = Number(process.env.SEMANTIC_BREAK_THRESHOLD ?? 0.72);
    const result: Array<{ content: string; page: number | null }> = [];

    let current = sentences[0];
    for (let i = 1; i < sentences.length; i += 1) {
      const similarity = this.cosine(vectors[i - 1], vectors[i]);
      const shouldBreak = similarity < threshold || current.length + sentences[i].length > chunkSize;

      if (shouldBreak) {
        result.push({ content: current.trim(), page });
        current = sentences[i];
      } else {
        current += ` ${sentences[i]}`;
      }
    }
    if (current.trim()) {
      result.push({ content: current.trim(), page });
    }
    return result;
  }

  private cosine(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
