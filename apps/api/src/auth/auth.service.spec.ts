import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { AuthService } from './auth.service.js';
import type { AuthRepository } from './auth.repository.js';
import type { users } from '@restaurant/db';

type UserRow = typeof users.$inferSelect;

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

function makeUser(overrides: Partial<UserRow>): UserRow {
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
  };
}

type FakeRepo = ReturnType<typeof fakeRepo>;

function makeService(repo: FakeRepo): AuthService {
  return new AuthService(
    repo as unknown as AuthRepository,
    new JwtService({ secret: 'test-secret' })
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
