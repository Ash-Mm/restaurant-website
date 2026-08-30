import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard.js';
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

function fakeRepo() {
  return {
    findUserById: jest.fn<
      (restaurantId: string, userId: string) => Promise<UserRow | null>
    >(),
  };
}

function ctxFor(headers: Record<string, string | undefined>) {
  const req: Record<string, unknown> = { headers };
  return {
    req,
    ctx: {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext,
  };
}

describe('JwtAuthGuard', () => {
  let jwt: JwtService;
  let repo: ReturnType<typeof fakeRepo>;

  beforeAll(() => {
    jwt = new JwtService({ secret: 'test-secret' });
  });

  beforeEach(() => {
    repo = fakeRepo();
  });

  const makeGuard = () => new JwtAuthGuard(jwt, repo as unknown as AuthRepository);

  it('accepts a valid access token and attaches the user and ids to the request', async () => {
    const token = await jwt.signAsync({ sub: 'u1', restaurantId: 'r1', role: 'owner' });
    repo.findUserById.mockResolvedValue(makeUser());
    const guard = makeGuard();
    const { req, ctx } = ctxFor({ authorization: `Bearer ${token}` });

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.userId).toBe('u1');
    expect(req.restaurantId).toBe('r1');
    expect((req.user as UserRow).email).toBe('owner@acme.test');
    expect(repo.findUserById).toHaveBeenCalledWith('r1', 'u1');
  });

  it('rejects a missing Authorization header', async () => {
    await expect(makeGuard().canActivate(ctxFor({}).ctx)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('rejects non-Bearer authorization schemes', async () => {
    await expect(
      makeGuard().canActivate(ctxFor({ authorization: 'Basic abc' }).ctx)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens signed with the wrong secret', async () => {
    const otherJwt = new JwtService({ secret: 'different-secret' });
    const token = await otherJwt.signAsync({ sub: 'u1', restaurantId: 'r1', role: 'owner' });
    await expect(
      makeGuard().canActivate(ctxFor({ authorization: `Bearer ${token}` }).ctx)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.findUserById).not.toHaveBeenCalled();
  });

  it('rejects when the user no longer exists in the token restaurant', async () => {
    const token = await jwt.signAsync({ sub: 'ghost', restaurantId: 'r1', role: 'owner' });
    repo.findUserById.mockResolvedValue(null);
    await expect(
      makeGuard().canActivate(ctxFor({ authorization: `Bearer ${token}` }).ctx)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
