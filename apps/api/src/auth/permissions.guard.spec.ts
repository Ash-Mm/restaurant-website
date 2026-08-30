import 'reflect-metadata';
import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { PermissionsGuard, hasPermission } from './permissions.guard.js';
import { parsePermissions } from './permissions.util.js';
import type { Reflector } from '@nestjs/core';
import type { AuthRepository } from './auth.repository.js';
import type { users } from '@restaurant/db';

type UserRow = typeof users.$inferSelect;

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'u1',
    restaurantId: 'r1',
    email: 'owner@acme.test',
    passwordHash: 'hash',
    fullName: 'Owner One',
    role: 'owner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as UserRow;
}

function fakeReflector(metadata: string[] | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn<() => string[] | undefined>().mockReturnValue(metadata),
  } as unknown as Reflector;
}

function fakeRepo(
  role: { permissions: string | null } | null
): AuthRepository {
  return {
    findRole: jest
      .fn<(restaurantId: string, name: string) => Promise<{ permissions: string | null } | null>>()
      .mockResolvedValue(role),
  } as unknown as AuthRepository;
}

interface FakeRequest {
  restaurantId?: string;
  user?: UserRow;
}

function ctxFor(req: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => PermissionsGuard,
  } as unknown as ExecutionContext;
}

describe('hasPermission', () => {
  it('grants wildcard permission', () => {
    expect(hasPermission(['*'], 'locations:write')).toBe(true);
  });

  it('grants exact permission', () => {
    expect(hasPermission(['locations:read', 'locations:write'], 'locations:write')).toBe(true);
  });

  it('denies missing permission', () => {
    expect(hasPermission(['locations:read'], 'locations:write')).toBe(false);
  });
});

describe('parsePermissions', () => {
  it('returns empty array for null', () => {
    expect(parsePermissions(null)).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parsePermissions('{oops')).toEqual([]);
  });

  it('filters non-string entries', () => {
    expect(parsePermissions('["a", 1, null, "b"]')).toEqual(['a', 'b']);
  });
});

describe('PermissionsGuard', () => {
  it('passes when no permissions metadata is present (no db call)', async () => {
    const findRole = jest
      .fn<(restaurantId: string, name: string) => Promise<{ permissions: string | null } | null>>()
      .mockResolvedValue({ permissions: '["*"]' });
    const repo = { findRole } as unknown as AuthRepository;
    const guard = new PermissionsGuard(fakeReflector(undefined), repo);
    const req: FakeRequest = { restaurantId: 'r1', user: makeUser() };
    expect(await guard.canActivate(ctxFor(req))).toBe(true);
    expect(findRole).not.toHaveBeenCalled();
  });

  it('rejects with 403-class error when no authenticated user', async () => {
    const guard = new PermissionsGuard(fakeReflector(['locations:read']), fakeRepo(null));
    const req: FakeRequest = { restaurantId: 'r1' };
    await expect(guard.canActivate(ctxFor(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects cross-tenant access (user belongs to another restaurant)', async () => {
    const guard = new PermissionsGuard(fakeReflector(['locations:read']), fakeRepo(null));
    const req: FakeRequest = { restaurantId: 'r2', user: makeUser({ restaurantId: 'r1' }) };
    await expect(guard.canActivate(ctxFor(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when role lacks the required permission', async () => {
    const guard = new PermissionsGuard(
      fakeReflector(['locations:write']),
      fakeRepo({ permissions: '["locations:read"]' })
    );
    const req: FakeRequest = { restaurantId: 'r1', user: makeUser({ role: 'cashier' }) };
    await expect(guard.canActivate(ctxFor(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when the user has no role row', async () => {
    const guard = new PermissionsGuard(
      fakeReflector(['locations:read']),
      fakeRepo(null)
    );
    const req: FakeRequest = { restaurantId: 'r1', user: makeUser({ role: 'ghost' }) };
    await expect(guard.canActivate(ctxFor(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('grants access when wildcard permission covers the requirement', async () => {
    const guard = new PermissionsGuard(
      fakeReflector(['settings:write']),
      fakeRepo({ permissions: '["*"]' })
    );
    const req: FakeRequest = { restaurantId: 'r1', user: makeUser({ role: 'owner' }) };
    expect(await guard.canActivate(ctxFor(req))).toBe(true);
  });

  it('grants access when role holds the exact permission', async () => {
    const repo = fakeRepo({ permissions: '["settings:read","settings:write"]' });
    const guard = new PermissionsGuard(fakeReflector(['settings:read']), repo);
    const req: FakeRequest = { restaurantId: 'r1', user: makeUser({ role: 'manager' }) };
    expect(await guard.canActivate(ctxFor(req))).toBe(true);
  });
});
