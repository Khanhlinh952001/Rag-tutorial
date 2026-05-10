import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import jwt from 'jsonwebtoken';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | undefined>;
      user?: JwtPayload;
    }>();
    const authHeader = request.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer 토큰이 필요합니다.');
    }

    const token = authHeader.slice('Bearer '.length);
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';

    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('토큰이 유효하지 않거나 만료되었습니다.');
    }
  }
}
