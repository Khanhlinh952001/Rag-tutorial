import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type { SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma.service';

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async register(input: { email: string; password: string; name?: string }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new UnauthorizedException('이미 존재하는 이메일입니다.');
    }

    const passwordHash = await hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        password: passwordHash,
        name: input.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const accessToken = this.signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, accessToken };
  }

  async login(input: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const isMatch = await compare(input.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const accessToken = this.signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
    };
  }

  private signToken(payload: JwtPayload): string {
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];
    return jwt.sign(payload, secret, { expiresIn });
  }
}
