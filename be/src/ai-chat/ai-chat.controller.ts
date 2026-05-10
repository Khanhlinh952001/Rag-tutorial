import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { join } from 'node:path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserJwtThrottlerGuard } from '../auth/user-jwt-throttler.guard';
import { AiChatService } from './ai-chat.service';
import { AskDto } from './dto/ask.dto';

@Controller('ai-chat')
export class AiChatController {
  constructor(
    @Inject(AiChatService)
    private readonly aiChatService: AiChatService,
  ) {}

  @Get('ui')
  ui(@Res() res: { sendFile: (path: string) => unknown }) {
    return res.sendFile(join(process.cwd(), 'public', 'ai-chat-test.html'));
  }

  @Get('my-conversations')
  @UseGuards(JwtAuthGuard)
  myConversations(
    @Req() req: { user?: { sub: string } },
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit ?? 20);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;
    return this.aiChatService.listMyConversations(req.user?.sub ?? '', safeLimit);
  }

  @Get('my-conversations/:conversationId')
  @UseGuards(JwtAuthGuard)
  myConversationDetail(
    @Req() req: { user?: { sub: string } },
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiChatService.getMyConversationDetail(req.user?.sub ?? '', conversationId);
  }

  @Delete('my-conversations/:conversationId')
  @UseGuards(JwtAuthGuard)
  deleteMyConversation(
    @Req() req: { user?: { sub: string } },
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiChatService.deleteMyConversation(req.user?.sub ?? '', conversationId);
  }

  @Post('search')
  @UseGuards(JwtAuthGuard, UserJwtThrottlerGuard)
  @Throttle({ aiChatBurst: {}, aiChatWindow: {} })
  search(@Body() dto: AskDto) {
    const defaultTopK = Number(process.env.AI_CHAT_TOP_K ?? 10);
    return this.aiChatService.search(
      dto.question,
      dto.topK ?? defaultTopK,
      dto.documentId,
      dto.scoreThreshold,
    );
  }

  @Post('ask')
  @UseGuards(JwtAuthGuard, UserJwtThrottlerGuard)
  @Throttle({ aiChatBurst: {}, aiChatWindow: {} })
  ask(
    @Req() req: { user?: { sub: string } },
    @Body() dto: AskDto,
  ) {
    const defaultTopK = Number(process.env.AI_CHAT_TOP_K ?? 10);
    return this.aiChatService.ask(
      req.user?.sub ?? '',
      dto.question,
      dto.conversationId,
      dto.topK ?? defaultTopK,
      dto.documentId,
      dto.scoreThreshold,
    );
  }
}
