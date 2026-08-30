import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ACCESS_TOKEN_TTL } from './auth.constants.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuditModule } from '../audit/audit.module.js';

export const LOGIN_RATE_WINDOW_MS = 60_000;

/**
 * Login rate limit (Notion Phase 2 task 7): 5 requests per minute per IP by
 * default. Read at app-compile time so tests can raise or lower it without
 * touching the production default.
 */
function loginRateLimit(): number {
  const parsed = Number.parseInt(process.env.LOGIN_RATE_LIMIT ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

@Module({
  imports: [
    AuditModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
        signOptions: { expiresIn: ACCESS_TOKEN_TTL },
      }),
    }),
    // Only guards that are explicitly attached (staff login) use this config.
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        { ttl: LOGIN_RATE_WINDOW_MS, limit: loginRateLimit() },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  exports: [JwtModule, AuthRepository],
})
export class AuthModule {}
