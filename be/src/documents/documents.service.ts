import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentTextExtractorService } from './extractors/document-text-extractor.service';
import { VectorService } from '../vector/vector.service';
import { PrismaService } from '../prisma.service';
import { DocumentStatus } from '../generated/prisma/enums';
import { QueuesService } from '../queues/queues.service';
import type { IngestWebDto } from './dto/ingest-web.dto';
import type { PreviewWebDto } from './dto/preview-web.dto';
import { extractTextFromHtml } from './extractors/web-html.extractor';
import {
  collectSameOriginLinks,
  normalizeVisitUrl,
} from './extractors/web-links.extractor';

const WEB_MIME = 'text/html';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DocumentTextExtractorService)
    private readonly documentTextExtractorService: DocumentTextExtractorService,
    @Inject(VectorService)
    private readonly vectorService: VectorService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(QueuesService)
    private readonly queuesService: QueuesService,
  ) {}

  async create(createDocumentDto: CreateDocumentDto) {
    const uploadedById = await this.resolveUploadedById(createDocumentDto.uploadedById);
    const document = await this.prisma.document.create({
      data: {
        title: createDocumentDto.title ?? createDocumentDto.originalName ?? basename(createDocumentDto.filePath),
        originalName:
          createDocumentDto.originalName ?? basename(createDocumentDto.filePath),
        filePath: createDocumentDto.filePath,
        mimeType: createDocumentDto.mimeType,
        fileSize: createDocumentDto.fileSize ?? 0,
        uploadedById,
        status: DocumentStatus.PENDING,
      },
    });
    await this.prisma.processingJob.create({
      data: {
        documentId: document.id,
        status: DocumentStatus.PENDING,
        currentStep: 'uploaded',
      },
    });

    await this.queuesService.enqueueDocument(document.id);

    return {
      documentId: document.id,
      status: 'queued',
      step: 'uploaded',
    };
  }

  /**
   * Fetch a public HTML page (or crawl entire site if entireSite), chunk, embed, store.
   */
  async ingestFromWeb(dto: IngestWebDto) {
    if (dto.selectedUrls != null && dto.selectedUrls.length > 0) {
      return this.ingestSelectedWebPages(dto);
    }
    if (dto.entireSite) {
      return this.ingestFromWebSite(dto);
    }

    const targetUrl = this.parseHttpUrl(dto.url);
    const html = await this.fetchWebPage(targetUrl.href);
    const extracted = extractTextFromHtml(html);
    if (!extracted.text.trim()) {
      throw new BadRequestException(
        'No readable text could be extracted from this page.',
      );
    }

    const uploadedById = await this.resolveUploadedById(dto.uploadedById);
    const title =
      dto.title?.trim() ||
      extracted.title ||
      targetUrl.hostname ||
      targetUrl.href;

    const document = await this.prisma.document.create({
      data: {
        title: title.slice(0, 500),
        originalName: targetUrl.pathname || '/',
        filePath: targetUrl.href,
        mimeType: WEB_MIME,
        fileSize: Buffer.byteLength(extracted.text, 'utf8'),
        uploadedById,
        status: DocumentStatus.PROCESSING,
      },
    });

    const processingJob = await this.prisma.processingJob.create({
      data: {
        documentId: document.id,
        status: DocumentStatus.PROCESSING,
        currentStep: 'extracting-web',
        startedAt: new Date(),
      },
    });

    try {
      const cleanedText = this.documentTextExtractorService.cleanExtractedText(
        extracted.text,
        'text/plain',
      );

      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'chunking' },
      });
      const chunks = await this.documentTextExtractorService.splitIntoChunks(
        cleanedText,
        WEB_MIME,
      );

      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'embedding' },
      });
      const vectorResult = await this.vectorService.indexDocumentChunks({
        documentId: document.id,
        mimeType: WEB_MIME,
        source: document.filePath,
        chunks: chunks.map((chunk) => ({
          ...chunk,
          metadata: {
            ...chunk.metadata,
            documentId: document.id,
            source: document.filePath,
            title: document.title,
            sourceType: 'web',
            url: document.filePath,
          },
        })),
      });

      if (chunks.length > 0) {
        await this.prisma.documentChunk.createMany({
          data: chunks.map((chunk, index) => ({
            documentId: document.id,
            chunkIndex: chunk.index,
            content: chunk.content,
            vectorId: vectorResult.vectorIds[index],
            metadata: {
              page: chunk.metadata.page,
              source: document.filePath,
              sourceType: 'web',
              url: document.filePath,
              title: document.title,
              mimeType: WEB_MIME,
            },
          })),
        });
      }

      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'indexing' },
      });
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.COMPLETED,
          totalChunks: chunks.length,
        },
      });
      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: {
          status: DocumentStatus.COMPLETED,
          currentStep: 'completed',
          completedAt: new Date(),
        },
      });

      return {
        documentId: document.id,
        url: document.filePath,
        title: document.title,
        textPreview: cleanedText.slice(0, 800),
        totalChunks: chunks.length,
        indexedChunks: vectorResult.indexed,
        vectorStore: vectorResult.store,
        status: 'completed',
      };
    } catch (error) {
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.FAILED },
      });
      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: {
          status: DocumentStatus.FAILED,
          currentStep: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async ingestSelectedWebPages(dto: IngestWebDto) {
    const seed = this.parseHttpUrl(dto.url);
    const host = seed.hostname.toLowerCase();
    const raw = dto.selectedUrls;
    if (!raw?.length) {
      throw new BadRequestException('selectedUrls must be a non-empty array.');
    }

    const seen = new Set<string>();
    const orderedUrls: string[] = [];
    for (const item of raw) {
      const u = this.parseHttpUrl(item);
      if (u.hostname.toLowerCase() !== host) {
        throw new BadRequestException(
          `URL must be same host as seed (${host}): ${item}`,
        );
      }
      const key = normalizeVisitUrl(u.href);
      if (seen.has(key)) continue;
      seen.add(key);
      orderedUrls.push(key);
    }

    const cap = Number(process.env.WEB_SELECTED_URLS_MAX ?? 500);
    const maxSel = Number.isFinite(cap) && cap >= 1 ? Math.min(500, Math.floor(cap)) : 500;
    if (orderedUrls.length > maxSel) {
      throw new BadRequestException(
        `Too many selected URLs (max ${maxSel}).`,
      );
    }

    const pages: Array<{
      url: string;
      pageTitle: string | null;
      cleanedText: string;
    }> = [];

    for (const pageUrl of orderedUrls) {
      try {
        const html = await this.fetchWebPage(pageUrl);
        const extracted = extractTextFromHtml(html);
        const cleaned = this.documentTextExtractorService.cleanExtractedText(
          extracted.text,
          'text/plain',
        );
        if (cleaned.trim()) {
          pages.push({
            url: pageUrl,
            pageTitle: extracted.title,
            cleanedText: cleaned,
          });
        }
      } catch {
        // skip failed pages
      }
    }

    if (pages.length === 0) {
      throw new BadRequestException(
        'No readable text from any selected URL.',
      );
    }

    const hash = createHash('sha256')
      .update(orderedUrls.join('\n'))
      .digest('hex')
      .slice(0, 16);
    const filePath = `site:${host}:selected:${hash}`;

    return this.persistSiteWebDocument(dto, seed, pages, filePath, 'selected', {
      pagesIndexed: pages.length,
      selectedRequested: orderedUrls.length,
    });
  }

  async ingestFromWebSite(dto: IngestWebDto) {
    const seed = this.parseHttpUrl(dto.url);
    const maxPages = this.resolveSiteMaxPages(dto.maxPages);
    const { pages, stoppedEarly } = await this.crawlSameOriginSite(seed, maxPages);

    if (pages.length === 0) {
      throw new BadRequestException(
        'No readable text could be extracted from this site crawl.',
      );
    }

    const siteKey = normalizeVisitUrl(seed.href);
    const filePath = `site:${seed.hostname}:${siteKey}`;
    return this.persistSiteWebDocument(dto, seed, pages, filePath, 'site', {
      pagesCrawled: pages.length,
      maxPages,
      stoppedEarly,
    });
  }

  private async persistSiteWebDocument(
    dto: IngestWebDto,
    seed: URL,
    pages: Array<{
      url: string;
      pageTitle: string | null;
      cleanedText: string;
    }>,
    filePath: string,
    mode: 'site' | 'selected',
    extraReturn: Record<string, unknown>,
  ) {
    const uploadedById = await this.resolveUploadedById(dto.uploadedById);
    const title =
      dto.title?.trim() || seed.hostname || seed.href;
    const totalBytes = pages.reduce(
      (sum, p) => sum + Buffer.byteLength(p.cleanedText, 'utf8'),
      0,
    );

    const document = await this.prisma.document.create({
      data: {
        title: title.slice(0, 500),
        originalName: seed.hostname,
        filePath,
        mimeType: WEB_MIME,
        fileSize: totalBytes,
        uploadedById,
        status: DocumentStatus.PROCESSING,
      },
    });

    const processingJob = await this.prisma.processingJob.create({
      data: {
        documentId: document.id,
        status: DocumentStatus.PROCESSING,
        currentStep: 'extracting-web',
        startedAt: new Date(),
      },
    });

    try {
      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'chunking' },
      });

      type ChunkRow = {
        index: number;
        content: string;
        metadata: {
          page: number | null;
          url: string;
          pageTitle: string | null;
        };
      };

      const allChunks: ChunkRow[] = [];
      let nextIndex = 0;
      for (const page of pages) {
        const split = await this.documentTextExtractorService.splitIntoChunks(
          page.cleanedText,
          WEB_MIME,
        );
        for (const ch of split) {
          allChunks.push({
            index: nextIndex++,
            content: ch.content,
            metadata: {
              page: ch.metadata.page,
              url: page.url,
              pageTitle: page.pageTitle,
            },
          });
        }
      }

      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'embedding' },
      });
      const vectorResult = await this.vectorService.indexDocumentChunks({
        documentId: document.id,
        mimeType: WEB_MIME,
        source: document.filePath,
        chunks: allChunks.map((chunk) => ({
          index: chunk.index,
          content: chunk.content,
          metadata: {
            ...chunk.metadata,
            documentId: document.id,
            source: document.filePath,
            title: document.title,
            sourceType: 'web-site',
          },
        })),
      });

      if (allChunks.length > 0) {
        await this.prisma.documentChunk.createMany({
          data: allChunks.map((chunk, index) => ({
            documentId: document.id,
            chunkIndex: chunk.index,
            content: chunk.content,
            vectorId: vectorResult.vectorIds[index],
            metadata: {
              page: chunk.metadata.page,
              source: document.filePath,
              sourceType: 'web-site',
              url: chunk.metadata.url,
              pageTitle: chunk.metadata.pageTitle,
              title: document.title,
              mimeType: WEB_MIME,
            },
          })),
        });
      }

      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'indexing' },
      });
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.COMPLETED,
          totalChunks: allChunks.length,
        },
      });
      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: {
          status: DocumentStatus.COMPLETED,
          currentStep: 'completed',
          completedAt: new Date(),
        },
      });

      return {
        documentId: document.id,
        url: document.filePath,
        title: document.title,
        mode,
        textPreview: pages[0]?.cleanedText.slice(0, 800) ?? '',
        totalChunks: allChunks.length,
        indexedChunks: vectorResult.indexed,
        vectorStore: vectorResult.store,
        status: 'completed',
        ...extraReturn,
      };
    } catch (error) {
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.FAILED },
      });
      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: {
          status: DocumentStatus.FAILED,
          currentStep: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async discoverWebSite(seedUrl: string, dtoMaxPages?: number) {
    const seed = this.parseHttpUrl(seedUrl);
    const maxFetches = this.resolveDiscoverMaxPages(dtoMaxPages);
    return this.discoverSameOriginSite(seed, maxFetches);
  }

  /**
   * Crawl + extract text only (no DB). Rate-limit at reverse proxy if exposed publicly.
   */
  async previewWeb(dto: PreviewWebDto) {
    const seed = this.parseHttpUrl(dto.url);
    if (dto.entireSite) {
      return this.previewWebSite(seed, dto.maxPages);
    }
    return this.previewSingleWebPage(seed.href);
  }

  private async previewSingleWebPage(targetHref: string) {
    const targetUrl = new URL(targetHref);
    const html = await this.fetchWebPage(targetUrl.href);
    const extracted = extractTextFromHtml(html);
    const cleaned = this.documentTextExtractorService.cleanExtractedText(
      extracted.text,
      'text/plain',
    );

    if (!cleaned.trim()) {
      throw new BadRequestException(
        'No readable text could be extracted from this page.',
      );
    }

    const maxChars = Number(process.env.WEB_PREVIEW_MAX_CHARS ?? 16_000);
    const safeMax = Number.isFinite(maxChars) && maxChars > 500 ? maxChars : 16_000;
    const truncated = cleaned.length > safeMax;
    const titleGuess =
      extracted.title?.trim() || targetUrl.hostname || targetUrl.href;

    return {
      mode: 'single' as const,
      url: targetUrl.href,
      suggestedTitle: titleGuess.slice(0, 500),
      rawCharCount: extracted.text.length,
      cleanedCharCount: cleaned.length,
      truncated,
      textPreview: truncated ? cleaned.slice(0, safeMax) : cleaned,
      previewCharCap: safeMax,
    };
  }

  private async previewWebSite(seed: URL, dtoMax?: number) {
    const maxPages = this.resolveSiteMaxPages(dtoMax);
    const { pages, stoppedEarly } = await this.crawlSameOriginSite(seed, maxPages);

    if (pages.length === 0) {
      throw new BadRequestException(
        'No readable text could be extracted from this site crawl.',
      );
    }

    const snippetLen = Number(process.env.WEB_SITE_PREVIEW_SNIPPET_CHARS ?? 600);
    const safeSnippet =
      Number.isFinite(snippetLen) && snippetLen > 50 ? Math.floor(snippetLen) : 600;

    return {
      mode: 'site' as const,
      seedUrl: normalizeVisitUrl(seed.href),
      suggestedTitle: seed.hostname,
      pageCount: pages.length,
      totalCleanedChars: pages.reduce((s, p) => s + p.cleanedText.length, 0),
      pages: pages.map((p) => ({
        url: p.url,
        pageTitle: p.pageTitle,
        cleanedCharCount: p.cleanedText.length,
        textPreview: p.cleanedText.slice(0, safeSnippet),
      })),
      maxPages,
      stoppedEarly,
    };
  }

  async processDocument(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const processingJob = await this.prisma.processingJob.create({
      data: {
        documentId: document.id,
        status: DocumentStatus.PROCESSING,
        currentStep: 'extracting',
        startedAt: new Date(),
      },
    });

    try {
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.PROCESSING },
      });
      const extractedText =
        await this.documentTextExtractorService.extractByMimeType(
          document.filePath,
          document.mimeType,
        );

      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'cleaning' },
      });
      const cleanedText = this.documentTextExtractorService.cleanExtractedText(
        extractedText,
        document.mimeType,
      );

      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'chunking' },
      });
      const chunks = await this.documentTextExtractorService.splitIntoChunks(
        cleanedText,
        document.mimeType,
      );

      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'embedding' },
      });
      const vectorResult = await this.vectorService.indexDocumentChunks({
        documentId: document.id,
        mimeType: document.mimeType,
        source: document.filePath,
        chunks: chunks.map((chunk) => ({
          ...chunk,
          metadata: {
            ...chunk.metadata,
            documentId: document.id,
            source: document.filePath,
            title: document.title,
          },
        })),
      });

      if (chunks.length > 0) {
        await this.prisma.documentChunk.createMany({
          data: chunks.map((chunk, index) => ({
            documentId: document.id,
            chunkIndex: chunk.index,
            content: chunk.content,
            vectorId: vectorResult.vectorIds[index],
            metadata: {
              page: chunk.metadata.page,
              source: document.filePath,
              title: document.title,
              mimeType: document.mimeType,
            },
          })),
        });
      }

      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { currentStep: 'indexing' },
      });
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.COMPLETED,
          totalChunks: chunks.length,
        },
      });
      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: {
          status: DocumentStatus.COMPLETED,
          currentStep: 'completed',
          completedAt: new Date(),
        },
      });

      return {
        documentId: document.id,
        textPreview: cleanedText.slice(0, 1000),
        chunksPreview: chunks.slice(0, 3),
        totalChunks: chunks.length,
        indexedChunks: vectorResult.indexed,
        vectorStore: vectorResult.store,
        status: 'completed',
        step: 'completed',
      };
    } catch (error) {
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.FAILED },
      });
      await this.prisma.processingJob.update({
        where: { id: processingJob.id },
        data: {
          status: DocumentStatus.FAILED,
          currentStep: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async findAll() {
    return this.prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { chunks: true } },
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
          take: 20,
        },
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  update(id: number, updateDocumentDto: UpdateDocumentDto) {
    return `This action updates a #${id} document`;
  }

  async remove(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      return { removed: false, reason: 'not_found' };
    }

    await this.vectorService.deleteDocumentVectors(id);
    await unlink(document.filePath).catch(() => undefined);
    await this.prisma.document.delete({ where: { id } });
    return { removed: true, id };
  }

  async syncFromDb(documentId?: string, limit?: number) {
    const safeLimit =
      Number.isFinite(limit) && limit != null && limit > 0 ? Math.floor(limit) : 50;
    const documents = await this.prisma.document.findMany({
      where: {
        status: DocumentStatus.COMPLETED,
        ...(documentId ? { id: documentId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: documentId ? 1 : safeLimit,
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    const syncedDocuments: Array<{ documentId: string; indexedChunks: number }> = [];
    let totalIndexedChunks = 0;

    for (const document of documents) {
      if (document.chunks.length === 0) {
        continue;
      }

      const indexResult = await this.vectorService.indexDocumentChunks({
        documentId: document.id,
        mimeType: document.mimeType,
        source: document.filePath,
        chunks: document.chunks.map((chunk) => ({
          index: chunk.chunkIndex,
          content: chunk.content,
          metadata: {
            documentId: document.id,
            source: document.filePath,
            title: document.title,
            page:
              chunk.metadata != null &&
              typeof chunk.metadata === 'object' &&
              'page' in chunk.metadata &&
              typeof chunk.metadata.page === 'number'
                ? chunk.metadata.page
                : undefined,
          },
        })),
      });

      const vectorIdByChunkIndex = new Map<number, string>();
      for (const vectorId of indexResult.vectorIds) {
        const chunkIndexRaw = vectorId.split('-').pop();
        const chunkIndex = Number(chunkIndexRaw);
        if (!Number.isFinite(chunkIndex)) continue;
        vectorIdByChunkIndex.set(chunkIndex, vectorId);
      }

      for (const chunk of document.chunks) {
        const vectorId = vectorIdByChunkIndex.get(chunk.chunkIndex);
        if (!vectorId) continue;
        await this.prisma.documentChunk.update({
          where: { id: chunk.id },
          data: { vectorId },
        });
      }

      syncedDocuments.push({
        documentId: document.id,
        indexedChunks: indexResult.indexed,
      });
      totalIndexedChunks += indexResult.indexed;
    }

    return {
      requestedDocumentId: documentId ?? null,
      processedDocuments: documents.length,
      syncedDocuments: syncedDocuments.length,
      totalIndexedChunks,
      details: syncedDocuments,
    };
  }

  private resolveSiteMaxPages(dtoMax?: number): number {
    const capRaw = Number(process.env.WEB_CRAWL_MAX_PAGES_CAP ?? 500);
    const fallbackRaw = Number(process.env.WEB_CRAWL_MAX_PAGES ?? 80);
    const safeCap =
      Number.isFinite(capRaw) && capRaw >= 1 ? Math.floor(capRaw) : 500;
    const fallback =
      Number.isFinite(fallbackRaw) && fallbackRaw >= 1
        ? Math.floor(fallbackRaw)
        : 80;
    const raw =
      dtoMax != null && Number.isFinite(dtoMax) && dtoMax >= 1
        ? Math.floor(Number(dtoMax))
        : fallback;
    return Math.min(Math.max(1, raw), safeCap);
  }

  private resolveDiscoverMaxPages(dtoMax?: number): number {
    const capRaw = Number(process.env.WEB_CRAWL_DISCOVER_CAP ?? 2000);
    const fallbackRaw = Number(process.env.WEB_CRAWL_DISCOVER_MAX ?? 500);
    const safeCap =
      Number.isFinite(capRaw) && capRaw >= 1 ? Math.floor(capRaw) : 2000;
    const fallback =
      Number.isFinite(fallbackRaw) && fallbackRaw >= 1
        ? Math.floor(fallbackRaw)
        : 500;
    const raw =
      dtoMax != null && Number.isFinite(dtoMax) && dtoMax >= 1
        ? Math.floor(Number(dtoMax))
        : fallback;
    return Math.min(Math.max(1, raw), safeCap);
  }

  /** BFS: list every successfully fetched page on the same hostname (metadata + short snippet). */
  private async discoverSameOriginSite(
    seed: URL,
    maxFetches: number,
  ): Promise<{
    seedUrl: string;
    hostname: string;
    pages: Array<{
      url: string;
      pageTitle: string | null;
      hasText: boolean;
      charCount: number;
      textPreview: string;
    }>;
    maxFetches: number;
    stoppedEarly: boolean;
  }> {
    const hostname = seed.hostname.toLowerCase();
    const visited = new Set<string>();
    const queued = new Set<string>();
    const queue: string[] = [];

    const enqueue = (href: string) => {
      let u: URL;
      try {
        u = new URL(href);
      } catch {
        return;
      }
      if (u.hostname.toLowerCase() !== hostname) return;
      const key = normalizeVisitUrl(u.href);
      if (visited.has(key) || queued.has(key)) return;
      queued.add(key);
      queue.push(key);
    };

    enqueue(normalizeVisitUrl(seed.href));

    const discovered: Array<{
      url: string;
      pageTitle: string | null;
      hasText: boolean;
      charCount: number;
      textPreview: string;
    }> = [];

    const delayMs = Math.max(0, Number(process.env.WEB_CRAWL_DELAY_MS ?? 0));
    const previewChars = Number(process.env.WEB_DISCOVER_PREVIEW_CHARS ?? 280);
    const safePreview =
      Number.isFinite(previewChars) && previewChars >= 50
        ? Math.floor(previewChars)
        : 280;

    let attempts = 0;

    while (queue.length > 0 && attempts < maxFetches) {
      const next = queue.shift()!;
      const key = normalizeVisitUrl(next);
      queued.delete(key);
      if (visited.has(key)) continue;
      visited.add(key);
      attempts += 1;

      let html: string;
      try {
        html = await this.fetchWebPage(key);
      } catch {
        continue;
      }

      if (delayMs > 0 && queue.length > 0 && attempts < maxFetches) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const extracted = extractTextFromHtml(html);
      const cleaned = this.documentTextExtractorService.cleanExtractedText(
        extracted.text,
        'text/plain',
      );
      const trimmed = cleaned.trim();
      const charCount = cleaned.length;
      discovered.push({
        url: key,
        pageTitle: extracted.title,
        hasText: trimmed.length > 0,
        charCount,
        textPreview: trimmed.slice(0, safePreview),
      });

      if (attempts < maxFetches) {
        for (const link of collectSameOriginLinks(html, key, hostname)) {
          enqueue(link);
        }
      }
    }

    const stoppedEarly = queue.length > 0;

    return {
      seedUrl: normalizeVisitUrl(seed.href),
      hostname: seed.hostname,
      pages: discovered,
      maxFetches,
      stoppedEarly,
    };
  }

  private async crawlSameOriginSite(
    seed: URL,
    maxPages: number,
  ): Promise<{
    pages: Array<{
      url: string;
      pageTitle: string | null;
      cleanedText: string;
    }>;
    stoppedEarly: boolean;
  }> {
    const hostname = seed.hostname.toLowerCase();
    const visited = new Set<string>();
    const queued = new Set<string>();
    const queue: string[] = [];

    const enqueue = (href: string) => {
      let u: URL;
      try {
        u = new URL(href);
      } catch {
        return;
      }
      if (u.hostname.toLowerCase() !== hostname) return;
      const key = normalizeVisitUrl(u.href);
      if (visited.has(key) || queued.has(key)) return;
      queued.add(key);
      queue.push(key);
    };

    enqueue(normalizeVisitUrl(seed.href));

    const pages: Array<{
      url: string;
      pageTitle: string | null;
      cleanedText: string;
    }> = [];

    const delayMs = Math.max(
      0,
      Number(process.env.WEB_CRAWL_DELAY_MS ?? 0),
    );

    let attempts = 0;

    while (queue.length > 0 && attempts < maxPages) {
      const next = queue.shift()!;
      const key = normalizeVisitUrl(next);
      queued.delete(key);
      if (visited.has(key)) continue;
      visited.add(key);
      attempts += 1;

      let html: string;
      try {
        html = await this.fetchWebPage(key);
      } catch {
        continue;
      }

      if (delayMs > 0 && queue.length > 0 && attempts < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const extracted = extractTextFromHtml(html);
      const cleaned = this.documentTextExtractorService.cleanExtractedText(
        extracted.text,
        'text/plain',
      );

      if (cleaned.trim()) {
        pages.push({
          url: key,
          pageTitle: extracted.title,
          cleanedText: cleaned,
        });
      }

      if (attempts < maxPages) {
        for (const link of collectSameOriginLinks(html, key, hostname)) {
          enqueue(link);
        }
      }
    }

    const stoppedEarly = queue.length > 0;

    return { pages, stoppedEarly };
  }

  private parseHttpUrl(raw: string): URL {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new BadRequestException('url is required.');
    }
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new BadRequestException('Invalid URL.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('Only http and https URLs are supported.');
    }
    return url;
  }

  private async fetchWebPage(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutMs = Number(process.env.WEB_INGEST_TIMEOUT_MS ?? 30_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            process.env.WEB_INGEST_USER_AGENT ??
            'Mozilla/5.0 (compatible; RagTutorial/1.0; +https://example.com)',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8,ko;q=0.7',
        },
      });
      if (!response.ok) {
        throw new BadRequestException(
          `Failed to fetch URL: HTTP ${response.status}`,
        );
      }
      const html = await response.text();
      if (!html.trim()) {
        throw new BadRequestException('Empty response body.');
      }
      return html;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.toLowerCase().includes('abort')) {
        throw new BadRequestException(
          `Fetch timed out after ${timeoutMs}ms.`,
        );
      }
      throw new BadRequestException(`Failed to fetch URL: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveUploadedById(uploadedById?: string): Promise<string> {
    if (uploadedById) {
      return uploadedById;
    }

    const user = await this.prisma.user.upsert({
      where: { email: 'system@local' },
      update: {},
      create: {
        email: 'system@local',
        password: 'system',
        name: 'System Uploader',
      },
    });

    return user.id;
  }
}
