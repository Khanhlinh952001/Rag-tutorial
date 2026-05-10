import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      message: "hello from create-prisma + nest",
    };
  }

  @Get('upload-ui')
  @Header('content-type', 'text/html; charset=utf-8')
  getUploadUi() {
    return readFileSync(join(process.cwd(), 'public', 'upload-ui.html'), 'utf-8');
  }

  @Get('admin-ui')
  @Header('content-type', 'text/html; charset=utf-8')
  getAdminUi() {
    return readFileSync(join(process.cwd(), 'public', 'admin-ui.html'), 'utf-8');
  }
}
