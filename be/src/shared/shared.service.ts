import { Injectable } from '@nestjs/common';
import { CreateSharedDto } from './dto/create-shared.dto';
import { UpdateSharedDto } from './dto/update-shared.dto';
import { extname } from 'node:path';

@Injectable()
export class SharedService {
  normalizeOriginalName(value?: string): string {
    const raw = value ?? 'document';
    try {
      return Buffer.from(raw, 'latin1').toString('utf8');
    } catch {
      return raw;
    }
  }

  detectMimeType(file: { mimetype?: string; originalname?: string }): string {
    const incoming = (file.mimetype ?? '').toLowerCase();
    if (incoming && incoming !== 'application/octet-stream') {
      return incoming;
    }

    const extension = extname(file.originalname ?? '').toLowerCase();
    switch (extension) {
      case '.pdf':
        return 'application/pdf';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case '.ppt':
        return 'application/vnd.ms-powerpoint';
      case '.txt':
        return 'text/plain';
      case '.json':
        return 'application/json';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      case '.hwp':
        return 'application/x-hwp';
      case '.hwpx':
        return 'application/haansofthwp';
      default:
        return incoming || 'application/octet-stream';
    }
  }

  buildSafeStoredFileName(originalName: string): string {
    const normalizedOriginalName = this.normalizeOriginalName(originalName);
    const suffix = Date.now();
    const safeBaseName = normalizedOriginalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 60);
    return `${safeBaseName || 'document'}-${suffix}${extname(normalizedOriginalName)}`;
  }

  create(createSharedDto: CreateSharedDto) {
    return 'This action adds a new shared';
  }

  findAll() {
    return `This action returns all shared`;
  }

  findOne(id: number) {
    return `This action returns a #${id} shared`;
  }

  update(id: number, updateSharedDto: UpdateSharedDto) {
    return `This action updates a #${id} shared`;
  }

  remove(id: number) {
    return `This action removes a #${id} shared`;
  }
}
