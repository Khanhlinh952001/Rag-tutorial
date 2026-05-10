import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KnowledgeSourceService } from './knowledge-source.service';
import type { DiscoverKnowledgeSchemaDto } from './dto/discover-knowledge-schema.dto';
import type { TestKnowledgeSourceDto } from './dto/test-knowledge-source.dto';
import type { UpsertKnowledgeSourceConfigDto } from './dto/upsert-knowledge-source-config.dto';
import type { SyncKnowledgeSourceDto } from './dto/sync-knowledge-source.dto';

@Controller('admin/knowledge-source')
@UseGuards(JwtAuthGuard)
export class KnowledgeSourceController {
  constructor(
    @Inject(KnowledgeSourceService)
    private readonly knowledgeSourceService: KnowledgeSourceService,
  ) {}

  @Get('config')
  getConfig(@Req() req: { user?: { role?: string } }) {
    this.assertAdmin(req.user?.role);
    return this.knowledgeSourceService.listConfigs();
  }

  @Get('config/:id')
  getConfigById(
    @Req() req: { user?: { role?: string } },
    @Param('id') id: string,
  ) {
    this.assertAdmin(req.user?.role);
    return this.knowledgeSourceService.getConfigById(id);
  }

  @Post('config')
  upsertConfig(
    @Req() req: { user?: { role?: string } },
    @Body() dto: UpsertKnowledgeSourceConfigDto,
  ) {
    this.assertAdmin(req.user?.role);
    return this.knowledgeSourceService.upsertConfig(dto);
  }

  @Post('test')
  testConnection(
    @Req() req: { user?: { role?: string } },
    @Body() dto: TestKnowledgeSourceDto,
  ) {
    this.assertAdmin(req.user?.role);
    return this.knowledgeSourceService.testConnection(dto.sourceId);
  }

  @Post('discover')
  discoverSchema(
    @Req() req: { user?: { role?: string } },
    @Body() dto: DiscoverKnowledgeSchemaDto,
  ) {
    this.assertAdmin(req.user?.role);
    return this.knowledgeSourceService.discoverSchema(dto);
  }

  @Post('sync')
  sync(
    @Req() req: { user?: { role?: string } },
    @Body() dto: SyncKnowledgeSourceDto,
  ) {
    this.assertAdmin(req.user?.role);
    return this.knowledgeSourceService.syncSource(dto.limit, dto.sourceId);
  }

  @Delete('config/:id')
  removeConfig(
    @Req() req: { user?: { role?: string } },
    @Param('id') id: string,
  ) {
    this.assertAdmin(req.user?.role);
    return this.knowledgeSourceService.removeConfig(id);
  }

  private assertAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }
  }
}
