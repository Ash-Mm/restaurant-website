import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { setRefreshCookie } from './cookies.js';
import { staffLoginSchema } from './dto/login.dto.js';
import type { StaffLoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('staff/login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(staffLoginSchema)) dto: StaffLoginDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ accessToken: string; user: unknown }> {
    const result = await this.service.login(dto);
    setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }
}
