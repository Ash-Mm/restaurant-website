import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { AuthService } from './auth.service.js';
import type { AuthRepository } from './auth.repository.js';
import type { users } from '@restaurant/db';

type UserRow = typeof users.$inferSelect;
interface TokenRow {
  id: string;
  restaurantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  replacedByTokenId: string | null;
}

function makeToken(overrides: Partial<TokenRow>): TokenRow {
  return {
    id: 't1',
    restaurantId: 'r1',
    userId: 'u1',
    tokenHash: 'hash-of-presented-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    revokedAt: null,
    replacedByTokenId: null,
    ...overrides,
  };
}

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

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

function fakeRepo() {
  return {
    findRestaurantIdBySlug: jest.fn<(slug: string) => Promise<string | null>>(),
    findUsersByEmail: jest.fn<
      (email: string, restaurantId?: string) => Promise<UserRow[]>
    >(),
    insertRefreshToken: jest.fn<
      (values: {
        restaurantId: string;
        userId: string;
        tokenHash: string;
        expiresAt: string;
      }) => Promise<{ id: string }>
    >(),
    findTokenByHash: jest.fn<(tokenHash: string) => Promise<TokenRow | null>>(),
    findUserById: jest.fn<
      (restaurantId: string, userId: string) => Promise<UserRow | null>
    >(),
    rotateRefreshToken: jest.fn<
      (
        oldTokenId: string,
        replacement: {
          restaurantId: string;
          userId: string;
          tokenHash: string;
          expiresAt: string;
        }
      ) => Promise<{ oldRow: TokenRow; newRow: TokenRow }>
    >(),
    revokeAllForUser: jest.fn<(userId: string) => Promise<void>>(),
    revokeToken: jest.fn<(tokenId: string) => Promise<void>>(),
    findRole: jest.fn<
      (restaurantId: string, name: string) => Promise<{
        id: string;
        restaurantId: string;
        name: string;
        permissions: string | null;
      } | null>
    >(),
    findRestaurantById: jest.fn<
      (restaurantId: string) => Promise<{
        id: string;
        name: string;
        slug: string;
        currency: string;
      } | null>
    >(),
    listLocationsForUser: jest.fn<
      (userId: string, restaurantId: string) => Promise<{ id: string; name: string }[]>
    >(),
  };
}

type FakeRepo = ReturnType<typeof fakeRepo>;

function makeService(repo: FakeRepo): AuthService {
  const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
  return new AuthService(
    repo as unknown as AuthRepository,
    new JwtService({ secret: 'test-secret' }),
    audit as never
  );
}

describe('AuthService.login', () => {
  let ownerHash: string;

  beforeAll(async () => {
    ownerHash = await hash('correct-password');
  });

  let repo: FakeRepo;

  beforeEach(() => {
    repo = fakeRepo();
  });

  it('returns an access token, the user, and a refresh token stored only as sha256', async () => {
    repo.findUsersByEmail.mockResolvedValue([
      makeUser({ passwordHash: ownerHash }),
    ]);
    repo.insertRefreshToken.mockResolvedValue({ id: 't1' });
    const service = makeService(repo);

    const result = await service.login({
      email: 'owner@acme.test',
      password: 'correct-password',
    });

    expect(result.user).toEqual({
      id: 'u1',
      email: 'owner@acme.test',
      fullName: 'Owner One',
      role: 'owner',
    });

    const jwt = new JwtService({ secret: 'test-secret' });
    const payload = await jwt.verifyAsync(result.accessToken);
    expect(payload).toMatchObject({
      sub: 'u1',
      restaurantId: 'r1',
      role: 'owner',
    });

    const stored = repo.insertRefreshToken.mock.calls[0]?.[0];
    expect(stored).toBeDefined();
    expect(stored?.userId).toBe('u1');
    expect(stored?.restaurantId).toBe('r1');
    expect(stored?.tokenHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex')
    );
    expect(stored?.tokenHash).not.toContain(result.refreshToken);

    const expectedExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const expiry = new Date(stored?.expiresAt ?? '').getTime();
    expect(Math.abs(expiry - expectedExpiry)).toBeLessThan(60_000);
  });

  it('rejects a wrong password with a generic 401', async () => {
    repo.findUsersByEmail.mockResolvedValue([
      makeUser({ passwordHash: ownerHash }),
    ]);
    const service = makeService(repo);

    const error = await service
      .login({ email: 'owner@acme.test', password: 'not-the-password' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).message).toBe(
      'Invalid email or password'
    );
  });

  it('rejects an unknown email with the same generic 401 as a wrong password', async () => {
    repo.findUsersByEmail.mockResolvedValue([]);
    const service = makeService(repo);

    const unknownEmail = await service
      .login({ email: 'nobody@acme.test', password: 'whatever' })
      .catch((e: unknown) => e);

    repo.findUsersByEmail.mockResolvedValue([
      makeUser({ passwordHash: ownerHash }),
    ]);
    const wrongPassword = await service
      .login({ email: 'owner@acme.test', password: 'wrong' })
      .catch((e: unknown) => e);

    expect(unknownEmail).toBeInstanceOf(UnauthorizedException);
    expect(wrongPassword).toBeInstanceOf(UnauthorizedException);
    expect((unknownEmail as UnauthorizedException).message).toBe(
      (wrongPassword as UnauthorizedException).message
    );
  });

  it('rejects an ambiguous email when no restaurant slug is provided', async () => {
    repo.findUsersByEmail.mockResolvedValue([
      makeUser({ passwordHash: ownerHash }),
      makeUser({ id: 'u2', restaurantId: 'r2', passwordHash: ownerHash }),
    ]);
    const service = makeService(repo);

    await expect(
      service.login({ email: 'owner@acme.test', password: 'correct-password' })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('scopes the user lookup to the restaurant resolved from restaurantSlug', async () => {
    repo.findRestaurantIdBySlug.mockResolvedValue('r1');
    repo.findUsersByEmail.mockResolvedValue([
      makeUser({ passwordHash: ownerHash }),
    ]);
    repo.insertRefreshToken.mockResolvedValue({ id: 't1' });
    const service = makeService(repo);

    const result = await service.login({
      email: 'owner@acme.test',
      password: 'correct-password',
      restaurantSlug: 'acme',
    });

    expect(repo.findRestaurantIdBySlug).toHaveBeenCalledWith('acme');
    expect(repo.findUsersByEmail).toHaveBeenCalledWith('owner@acme.test', 'r1');
    expect(result.user.id).toBe('u1');
  });

  it('rejects an unknown restaurant slug', async () => {
    repo.findRestaurantIdBySlug.mockResolvedValue(null);
    const service = makeService(repo);

    await expect(
      service.login({
        email: 'owner@acme.test',
        password: 'correct-password',
        restaurantSlug: 'ghost',
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.findUsersByEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService.refresh', () => {
  let repo: FakeRepo;

  beforeEach(() => {
    repo = fakeRepo();
  });

  it('rotates the token and returns a new access token for the same user', async () => {
    const presented = 'raw-refresh-token';
    repo.findTokenByHash.mockResolvedValue(
      makeToken({ tokenHash: createHash('sha256').update(presented).digest('hex') })
    );
    repo.findUserById.mockResolvedValue(
      makeUser({ id: 'u1', restaurantId: 'r1', role: 'owner' })
    );

    repo.rotateRefreshToken.mockImplementation(
      (
        _oldTokenId: string,
        replacement: { restaurantId: string; userId: string; tokenHash: string }
      ) =>
        Promise.resolve({
          oldRow: makeToken({ revokedAt: new Date().toISOString() }),
          newRow: makeToken({
            id: 't2',
            tokenHash: replacement.tokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        })
    );

    const service = makeService(repo);
    const result = await service.refresh(presented);

    expect(result.refreshToken).not.toBe(presented);
    expect(result.user).toMatchObject({ id: 'u1', role: 'owner' });
    expect(repo.rotateRefreshToken).toHaveBeenCalledTimes(1);
    const firstRotateCall = repo.rotateRefreshToken.mock.calls[0];
    if (!firstRotateCall) throw new Error('rotateRefreshToken was not called');
    const [oldTokenId, replacement] = firstRotateCall;
    expect(oldTokenId).toBe('t1');
    expect(replacement.tokenHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex')
    );
    expect(replacement.userId).toBe('u1');

    const jwt = new JwtService({ secret: 'test-secret' });
    const payload = await jwt.verifyAsync(result.accessToken);
    expect(payload).toMatchObject({ sub: 'u1', restaurantId: 'r1' });
  });

  it('rejects a revoked (already used) token and revokes all tokens for that user', async () => {
    repo.findTokenByHash.mockResolvedValue(
      makeToken({ revokedAt: new Date().toISOString() })
    );
    const service = makeService(repo);

    await expect(
      service.refresh('replayed-token')
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(repo.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('rejects an expired token without rotating', async () => {
    repo.findTokenByHash.mockResolvedValue(
      makeToken({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    );
    const service = makeService(repo);

    await expect(service.refresh('expired-token')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(repo.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('rejects a token hash that is not in the database', async () => {
    repo.findTokenByHash.mockResolvedValue(null);
    const service = makeService(repo);

    await expect(service.refresh('unknown-token')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('rejects a missing token without touching the database', async () => {
    const service = makeService(repo);

    await expect(service.refresh(null)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(repo.findTokenByHash).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  let repo: FakeRepo;

  beforeEach(() => {
    repo = fakeRepo();
  });

  it('revokes the presented refresh token when it belongs to the user', async () => {
    const presented = 'raw-refresh-token';
    repo.findTokenByHash.mockResolvedValue(
      makeToken({ tokenHash: createHash('sha256').update(presented).digest('hex'), userId: 'u1' })
    );
    const service = makeService(repo);

    await service.logout('u1', presented);

    expect(repo.revokeToken).toHaveBeenCalledTimes(1);
    expect(repo.revokeToken).toHaveBeenCalledWith('t1');
  });

  it('does not revoke a refresh token belonging to a different user', async () => {
    const presented = 'someone-elses-token';
    repo.findTokenByHash.mockResolvedValue(
      makeToken({ tokenHash: createHash('sha256').update(presented).digest('hex'), userId: 'u2' })
    );
    const service = makeService(repo);

    await service.logout('u1', presented);

    expect(repo.revokeToken).not.toHaveBeenCalled();
  });

  it('resolves silently when no cookie is present', async () => {
    const service = makeService(repo);
    await expect(service.logout('u1', null)).resolves.toBeUndefined();
    expect(repo.findTokenByHash).not.toHaveBeenCalled();
  });

  it('resolves silently when the token is unknown (idempotent logout)', async () => {
    repo.findTokenByHash.mockResolvedValue(null);
    const service = makeService(repo);
    await expect(service.logout('u1', 'stale-token')).resolves.toBeUndefined();
    expect(repo.revokeToken).not.toHaveBeenCalled();
  });
});

describe('AuthService.me', () => {
  let repo: FakeRepo;

  beforeEach(() => {
    repo = fakeRepo();
    repo.findRole.mockResolvedValue({
      id: 'role1',
      restaurantId: 'r1',
      name: 'owner',
      permissions: JSON.stringify(['*']),
    });
    repo.findRestaurantById.mockResolvedValue({
      id: 'r1',
      name: 'Acme',
      slug: 'acme',
      currency: 'EGP',
    });
    repo.listLocationsForUser.mockResolvedValue([{ id: 'l1', name: 'Main Branch' }]);
  });

  it('returns the user with permissions, restaurant, and assigned locations', async () => {
    const service = makeService(repo);

    const result = await service.me(
      makeUser({ id: 'u1', restaurantId: 'r1', role: 'owner' })
    );

    expect(result).toEqual({
      id: 'u1',
      email: 'owner@acme.test',
      fullName: 'Owner One',
      role: 'owner',
      permissions: ['*'],
      restaurant: { id: 'r1', name: 'Acme', slug: 'acme', currency: 'EGP' },
      locations: [{ id: 'l1', name: 'Main Branch' }],
    });
    expect(repo.findRole).toHaveBeenCalledWith('r1', 'owner');
    expect(repo.listLocationsForUser).toHaveBeenCalledWith('u1', 'r1');
  });

  it('returns empty permissions when the role row is missing', async () => {
    repo.findRole.mockResolvedValue(null);
    const service = makeService(repo);

    const result = await service.me(makeUser({ role: 'custom-role' }));
    expect(result.permissions).toEqual([]);
  });

  it('returns empty permissions when the role permissions json is malformed', async () => {
    repo.findRole.mockResolvedValue({
      id: 'role1',
      restaurantId: 'r1',
      name: 'owner',
      permissions: 'not-json',
    });
    const service = makeService(repo);

    const result = await service.me(makeUser());
    expect(result.permissions).toEqual([]);
  });
});
