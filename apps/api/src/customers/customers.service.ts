import { createHash, randomBytes } from 'node:crypto';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CustomersRepository, type CustomerRow } from './customers.repository.js';
import type { GuestSessionDto } from './dto/guest-session.dto.js';

export const GUEST_TRACKING_TTL_DAYS = 30;
const GUEST_TRACKING_TTL_MS = GUEST_TRACKING_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface GuestSession {
  customerId: string;
  trackingToken: string;
}

export interface PublicCustomer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export function hashTrackingToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Guest checkout identity (Notion Phase 2 task 6). A guest receives an opaque
 * tracking token exactly once; only its SHA-256 hash is persisted, mirroring
 * the refresh-token rules in AGENTS.md section 9.
 */
@Injectable()
export class CustomersService {
  constructor(private readonly repo: CustomersRepository) {}

  async createGuestSessionForSlug(slug: string, profile?: GuestSessionDto): Promise<GuestSession> {
    const restaurantId = await this.repo.findRestaurantIdBySlug(slug);
    if (!restaurantId) {
      throw new NotFoundException('Restaurant not found');
    }
    return this.createGuestSession(restaurantId, profile);
  }

  async createGuestSession(
    restaurantId: string,
    profile?: GuestSessionDto
  ): Promise<GuestSession> {
    const rawToken = randomBytes(32).toString('base64url');
    const row = await this.repo.insertGuestCustomer({
      restaurantId,
      name: profile?.name,
      email: profile?.email,
      phone: profile?.phone,
      trackingTokenHash: hashTrackingToken(rawToken),
      trackingExpiresAt: new Date(Date.now() + GUEST_TRACKING_TTL_MS).toISOString(),
    });
    return { customerId: row.id, trackingToken: rawToken };
  }

  /**
   * Resolves a tracking token scoped to one restaurant. Unknown, revoked, and
   * expired tokens all fail with the same 401 (no information leak).
   */
  async resolveTrackingTokenForSlug(
    slug: string,
    rawToken: string
  ): Promise<PublicCustomer> {
    const restaurantId = await this.repo.findRestaurantIdBySlug(slug);
    if (!restaurantId) {
      throw new NotFoundException('Restaurant not found');
    }
    const row = await this.repo.findByTrackingTokenHash(
      restaurantId,
      hashTrackingToken(rawToken)
    );
    const expiresAt = row?.trackingExpiresAt;
    if (
      !row ||
      expiresAt === null ||
      expiresAt === undefined ||
      expiresAt <= new Date().toISOString()
    ) {
      throw new UnauthorizedException('Invalid tracking token');
    }
    return toPublicCustomer(row);
  }

  async revokeTrackingToken(restaurantId: string, customerId: string): Promise<void> {
    await this.repo.revokeTrackingToken(restaurantId, customerId);
  }
}

function toPublicCustomer(row: CustomerRow): PublicCustomer {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone };
}
