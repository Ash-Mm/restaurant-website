import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { TenantGuard } from './tenant.guard.js';
import { LocationGuard } from './location.guard.js';
import type { TenantRepository } from './tenant.repository.js';

interface FakeRequest {
  headers: Record<string, string | undefined>;
  restaurantId?: string;
  locationId?: string;
}

function ctxFor(headers: Record<string, string | undefined>, restaurantId?: string): ExecutionContext {
  const req: FakeRequest = { headers, restaurantId };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function fakeRepo(overrides: Partial<TenantRepository> = {}): TenantRepository {
  return {
    findBySlug: vi.fn(),
    verifyLocation: vi.fn(),
    ...overrides,
  } as unknown as TenantRepository;
}

describe('TenantGuard', () => {
  it('attaches restaurantId resolved from slug header', async () => {
    const repo = fakeRepo({ findBySlug: vi.fn().mockResolvedValue({ id: 'r1' }) });
    const guard = new TenantGuard(repo);
    const ctx = ctxFor({ 'x-restaurant-slug': 'acme' });
    expect(await guard.canActivate(ctx)).toBe(true);
    const req = ctx.switchToHttp().getRequest<FakeRequest>();
    expect(req.restaurantId).toBe('r1');
  });

  it('throws when slug header is missing', async () => {
    const repo = fakeRepo();
    const guard = new TenantGuard(repo);
    await expect(guard.canActivate(ctxFor({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws on unknown slug', async () => {
    const repo = fakeRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
    const guard = new TenantGuard(repo);
    await expect(guard.canActivate(ctxFor({ 'x-restaurant-slug': 'nope' }))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});

describe('LocationGuard', () => {
  it('verifies location for the resolved restaurant', async () => {
    const repo = fakeRepo({ verifyLocation: vi.fn().mockResolvedValue(true) });
    const guard = new LocationGuard(repo);
    const ctx = ctxFor({ 'x-location-id': 'l1' }, 'r1');
    expect(await guard.canActivate(ctx)).toBe(true);
    const req = ctx.switchToHttp().getRequest<FakeRequest>();
    expect(req.locationId).toBe('l1');
  });

  it('throws without restaurant context', async () => {
    const repo = fakeRepo();
    const guard = new LocationGuard(repo);
    await expect(guard.canActivate(ctxFor({ 'x-location-id': 'l1' }))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('throws on unknown location', async () => {
    const repo = fakeRepo({ verifyLocation: vi.fn().mockResolvedValue(false) });
    const guard = new LocationGuard(repo);
    await expect(guard.canActivate(ctxFor({ 'x-location-id': 'l1' }, 'r1'))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});
