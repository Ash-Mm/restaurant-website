import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './cookies.js';
import { staffLoginSchema } from './dto/login.dto.js';
import type { StaffLoginDto } from './dto/login.dto.js';
import type { AppRequest } from './request.types.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('staff/login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async login(
    @Body(new ZodValidationPipe(staffLoginSchema)) dto: StaffLoginDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ accessToken: string; user: unknown }> {
    const result = await this.service.login(dto);
    setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('staff/refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ accessToken: string; user: unknown }> {
    const result = await this.service.refresh(readRefreshCookie(req));
    setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('staff/logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request & { userId?: string },
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    const userId = req.userId;
    if (typeof userId === 'string') {
      await this.service.logout(userId, readRefreshCookie(req));
    }
    clearRefreshCookie(res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: NonNullable<AppRequest['user']>) {
    return this.service.me(user);
  }
}
