import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import { ACCESS_TOKEN_TTL, REFRESH_TTL_MS } from './auth.constants.js';
import { AuthRepository, type UserRow } from './auth.repository.js';
import { parsePermissions } from './permissions.util.js';
import { AuditService } from '../audit/audit.service.js';
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
    private readonly jwt: JwtService,
    private readonly audit: AuditService
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
      // Failed login with a resolvable restaurant: record it (the audit_logs
      // table requires restaurant_id, so unknown-email attempts are skipped).
      await this.audit.log({
        restaurantId: user.restaurantId,
        userId: user.id,
        action: 'auth.login.failure',
        entityType: 'user',
        entityId: user.id,
        metadata: { email: dto.email, reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.createRefreshToken(user);
    await this.audit.log({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: 'auth.login.success',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email },
    });
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
      const scopedUser = scoped[0];
      if (!scopedUser) {
        await verify(DUMMY_HASH, email);
        throw new UnauthorizedException('Invalid email or password');
      }
      return scopedUser;
    }

    const matches = await this.repo.findUsersByEmail(email);
    const matchedUser = matches[0];
    if (matches.length !== 1 || !matchedUser) {
      await verify(DUMMY_HASH, email);
      throw new UnauthorizedException('Invalid email or password');
    }
    return matchedUser;
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
      await this.audit.log({
        restaurantId: token.restaurantId,
        userId: token.userId,
        action: 'auth.refresh.reuse_detected',
        entityType: 'user',
        entityId: token.userId,
        metadata: { reason: 'rotated_token_replay' },
      });
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

  /**
   * Revokes the presented refresh token if it belongs to the given user.
   * Idempotent: a missing or unknown token resolves without error.
   */
  async logout(userId: string, rawToken: string | null): Promise<void> {
    if (!rawToken) {
      return;
    }
    const token = await this.repo.findTokenByHash(hashRefreshToken(rawToken));
    if (token?.userId !== userId) {
      return;
    }
    await this.repo.revokeToken(token.id);
    await this.audit.log({
      restaurantId: token.restaurantId,
      userId,
      action: 'auth.logout',
      entityType: 'user',
      entityId: userId,
      metadata: {},
    });
  }

  async me(user: UserRow): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    permissions: string[];
    restaurant: { id: string; name: string; slug: string; currency: string };
    locations: { id: string; name: string }[];
  }> {
    const [role, restaurant, assignedLocations] = await Promise.all([
      this.repo.findRole(user.restaurantId, user.role),
      this.repo.findRestaurantById(user.restaurantId),
      this.repo.listLocationsForUser(user.id, user.restaurantId),
    ]);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: parsePermissions(role?.permissions ?? null),
      restaurant: restaurant ?? { id: user.restaurantId, name: '', slug: '', currency: '' },
      locations: assignedLocations,
    };
  }
}

export { ACCESS_TOKEN_TTL };
