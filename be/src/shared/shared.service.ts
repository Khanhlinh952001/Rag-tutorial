import { Injectable } from '@nestjs/common';
import { CreateSharedDto } from './dto/create-shared.dto';
import { UpdateSharedDto } from './dto/update-shared.dto';
import { extname } from 'node:path';

@Injectable()
export class SharedService {
  /**
   * Multipart filenames are often UTF-8 bytes mis-decoded as Latin-1 (mojibake).
   * Do not latin1→utf8 when `raw` already contains real CJK/Hangul (would corrupt in Node).
   */
  normalizeOriginalName(value?: string): string {
    const raw = value?.trim() || 'document';
    if (raw === 'document') return raw;

    let recovered: string;
    try {
      recovered = Buffer.from(raw, 'latin1').toString('utf8');
    } catch {
      return raw;
    }

    const hangulSyllable = /[\uAC00-\uD7AF]/;
    const hangulJamo = /[\u1100-\u11FF\u3130-\u318F]/;
    const cjkHan = /[\u4E00-\u9FFF]/;
    const kana = /[\u3040-\u30FF]/;

    const rawHasCjk =
      hangulSyllable.test(raw) ||
      hangulJamo.test(raw) ||
      cjkHan.test(raw) ||
      kana.test(raw);
    const recoveredHasCjk =
      hangulSyllable.test(recovered) ||
      hangulJamo.test(recovered) ||
      cjkHan.test(recovered) ||
      kana.test(recovered);

    if (rawHasCjk) {
      return raw;
    }

    if (
      recoveredHasCjk &&
      recovered !== raw &&
      !recovered.includes('\uFFFD')
    ) {
      return recovered;
    }

    const latinExtendedNoise = (s: string) =>
      [...s].filter((ch) => {
        const c = ch.codePointAt(0) ?? 0;
        return c >= 0xc0 && c <= 0x024f;
      }).length;

    const rawNoise = latinExtendedNoise(raw);
    const recoveredNoise = latinExtendedNoise(recovered);
    if (
      !rawHasCjk &&
      recovered !== raw &&
      !recovered.includes('\uFFFD') &&
      rawNoise >= 4 &&
      recoveredNoise < rawNoise
    ) {
      return recovered;
    }

    return raw;
  }

  detectMimeType(file: { mimetype?: string; originalname?: string }): string {
    const incoming = (file.mimetype ?? '').toLowerCase();
    if (incoming && incoming !== 'application/octet-stream') {
      return incoming;
    }

    const extension = extname(this.normalizeOriginalName(file.originalname ?? '')).toLowerCase();
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
    const ext = extname(normalizedOriginalName);
    const baseRaw = ext
      ? normalizedOriginalName.slice(0, -ext.length)
      : normalizedOriginalName;
    const safeBaseName = baseRaw
      .replace(/[/\\?\u0000-\u001f]/g, '_')
      .trim()
      .slice(0, 180);
    return `${safeBaseName || 'document'}-${suffix}${ext || ''}`;
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
