import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import { ACCESS_TOKEN_TTL, REFRESH_TTL_MS } from './auth.constants.js';
import { AuthRepository, type UserRow } from './auth.repository.js';
import type { StaffLoginDto } from './dto/login.dto.js';

/**
 * A throwaway argon2id hash verified whenever credentials fail, so that
 * unknown-email and wrong-password responses take the same time (no user
 * enumeration via response timing).
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$XcovWBxX/nmjQwU/35HSaQ$Jo0R9kzalQufaXbrMeYAeLPYGpsTp3uOYIDU8TC7j8k';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService
  ) {}

  async issueAccessToken(user: UserRow): Promise<string> {
    return this.jwt.signAsync({
      sub: user.id,
      restaurantId: user.restaurantId,
      role: user.role,
    });
  }

  async login(dto: StaffLoginDto): Promise<LoginResult> {
    const user = await this.resolveUser(dto.email, dto.restaurantSlug);
    const passwordOk = await verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.createRefreshToken(user);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  private async resolveUser(email: string, restaurantSlug?: string): Promise<UserRow> {
    if (restaurantSlug !== undefined) {
      const restaurantId = await this.repo.findRestaurantIdBySlug(restaurantSlug);
      if (!restaurantId) {
        await verify(DUMMY_HASH, email);
        throw new UnauthorizedException('Invalid email or password');
      }
      const scoped = await this.repo.findUsersByEmail(email, restaurantId);
      if (scoped.length === 0) {
        await verify(DUMMY_HASH, email);
        throw new UnauthorizedException('Invalid email or password');
      }
      return scoped[0] as UserRow;
    }

    const matches = await this.repo.findUsersByEmail(email);
    if (matches.length !== 1) {
      await verify(DUMMY_HASH, email);
      throw new UnauthorizedException('Invalid email or password');
    }
    return matches[0] as UserRow;
  }

  private async createRefreshToken(user: UserRow): Promise<string> {
    const rawToken = randomBytes(32).toString('base64url');
    await this.repo.insertRefreshToken({
      restaurantId: user.restaurantId,
      userId: user.id,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
    });
    return rawToken;
  }

  async refresh(rawToken: string | null): Promise<LoginResult> {
    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const token = await this.repo.findTokenByHash(hashRefreshToken(rawToken));
    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (token.revokedAt !== null) {
      // Reuse of a rotated token means the session material may be stolen:
      // revoke every active session for this user (token-theft detection).
      await this.repo.revokeAllForUser(token.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (token.expiresAt <= new Date().toISOString()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.repo.findUserById(token.restaurantId, token.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const rawReplacement = randomBytes(32).toString('base64url');
    await this.repo.rotateRefreshToken(token.id, {
      restaurantId: token.restaurantId,
      userId: token.userId,
      tokenHash: hashRefreshToken(rawReplacement),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
    });
    const accessToken = await this.issueAccessToken(user);
    return {
      accessToken,
      refreshToken: rawReplacement,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}

export { ACCESS_TOKEN_TTL };
