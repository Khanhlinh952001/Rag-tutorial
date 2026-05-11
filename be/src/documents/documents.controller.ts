import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SyncDbDto } from './dto/sync-db.dto';
import { IngestWebDto } from './dto/ingest-web.dto';
import { DiscoverWebDto } from './dto/discover-web.dto';
import { PreviewWebDto } from './dto/preview-web.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(
    @Inject(DocumentsService)
    private readonly documentsService: DocumentsService,
  ) {}

  @Post()
  create(@Body() createDocumentDto: CreateDocumentDto) {
    return this.documentsService.create(createDocumentDto);
  }

  @Post('sync-db')
  syncDb(@Body() dto: SyncDbDto) {
    return this.documentsService.syncFromDb(dto.documentId, dto.limit);
  }

  /** BFS same-origin: list discovered pages (for user selection before ingest). */
  @Post('discover-web')
  discoverWeb(@Body() dto: DiscoverWebDto) {
    return this.documentsService.discoverWebSite(dto.url, dto.maxPages);
  }

  /** Crawl URL and return extracted text without indexing. */
  @Post('preview-web')
  previewWeb(@Body() dto: PreviewWebDto) {
    return this.documentsService.previewWeb(dto);
  }

  /** Download HTML, extract text, chunk, embed — same index as file uploads. */
  @Post('from-web')
  ingestFromWeb(@Body() dto: IngestWebDto) {
    return this.documentsService.ingestFromWeb(dto);
  }

  @Get()
  findAll() {
    return this.documentsService.findAll();
  }

  /** Stream uploaded image bytes (JWT). Chat UI uses this to show retrieved images. */
  @Get(':id/asset')
  @UseGuards(JwtAuthGuard)
  async getImageAsset(@Param('id') id: string): Promise<StreamableFile> {
    const { stream, mimeType } = await this.documentsService.createImageAssetReadStream(id);
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: `inline; filename="document-${id}"`,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDocumentDto: UpdateDocumentDto) {
    return this.documentsService.update(+id, updateDocumentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
