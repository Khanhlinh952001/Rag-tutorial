import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(
    @Req()
    req: {
      user?: {
        sub: string;
        email: string;
        role: string;
      };
    },
  ) {
    return {
      userId: req.user?.sub ?? null,
      email: req.user?.email ?? null,
      role: req.user?.role ?? null,
    };
  }
}
