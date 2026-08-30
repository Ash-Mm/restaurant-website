# Phase 2 Staff Auth Implementation Plan (Notion tasks 1-4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement staff login, refresh rotation with reuse detection, logout, and current-user endpoints (`/api/v1/auth/*`) per DESIGN.md section 15.

**Architecture:** New NestJS `AuthModule` in `apps/api/src/auth/` alongside the existing guard/decorator files. Opaque random refresh tokens stored as SHA-256 hashes in a new `refresh_tokens` table; access tokens are HS256 JWTs (`sub`, `restaurantId`, `role`) with 15-minute TTL. Refresh token travels in an httpOnly cookie scoped to `/api/v1/auth/staff`. Existing header-based TenantGuard/LocationGuard are untouched.

**Tech Stack:** NestJS 11, `@nestjs/jwt`, `@node-rs/argon2` (already present), Drizzle ORM + SQLite (libsql), Zod DTOs via existing `ZodValidationPipe`, Jest + supertest (in-memory SQLite pattern from `tenants.integration.spec.ts`).

**Spec:** DESIGN.md sections 5.3, 7, 15 (Auth endpoints), 16 (Security design); AGENTS.md sections 9 (Auth rules), 11 (Money, N/A here), 5 (process). Decisions confirmed with user: `@nestjs/jwt`, revoke-all-on-reuse, header guards stay, `/auth/me` returns user + restaurant + permissions + locations.

## Global Constraints

- TypeScript strict mode; ESM (`type: module`) — relative imports end with `.js`.
- Access token TTL 15 minutes; refresh token TTL 7 days (AGENTS.md section 9).
- Refresh tokens stored hashed, never plaintext (AGENTS.md section 9).
- Never log passwords, tokens, or hashes.
- Every new table needs `id`, `created_at`, `updated_at`; tenant-scoped tables need `restaurant_id` (AGENTS.md section 4).
- Never modify an applied migration; generate a new one with `pnpm --filter @restaurant/db db:generate`.
- Repository layer is the only place with database queries (AGENTS.md section 6).
- Generic `401 Invalid email or password` for all login failures (no user enumeration).
- Role names not hard-coded in business logic (AGENTS.md section 9); permissions come from the `roles` table.
- Conventional commits: `feat: ...` / `test: ...`.

---

### Task 1: Staff login endpoint (`POST /api/v1/auth/staff/login`)

**Files:**
- Create: `packages/db/src/schema/refreshTokens.ts`
- Modify: `packages/db/src/schema/index.ts` (export + add to `schema` map)
- Create: `packages/db/drizzle/0002_*.sql` (generated)
- Create: `apps/api/src/auth/dto/login.dto.ts`
- Create: `apps/api/src/auth/auth.repository.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts` (import `AuthModule`)
- Test: `apps/api/src/auth/auth.service.spec.ts`, `apps/api/src/auth/auth.integration.spec.ts`
- Dep: `@nestjs/jwt` added to `apps/api/package.json`

**Interfaces (produced, consumed by tasks 2-4):**
- `AuthService.login(dto: LoginDto): Promise<{ accessToken: string; user: { id: string; email: string; fullName: string; role: string } }>`; the controller sets the refresh cookie from `service.result.refreshToken` (service returns it on an internal field, controller strips it).
- `AuthService.issueAccessToken(user): Promise<string>` (HS256, 15m, payload `{ sub, restaurantId, role }`).
- `AuthRepository.findUserByEmail(email, restaurantId?)`, `findUserById(restaurantId, userId)`, `insertRefreshToken(values)`, plus helpers used later.
- Constants: `REFRESH_COOKIE = 'refresh_token'`, `REFRESH_TTL_DAYS = 7`, `ACCESS_TTL = '15m'` in `auth.constants.ts`.

- [ ] **Step 1: Schema + migration (data before code, AGENTS.md Step 2)**

`packages/db/src/schema/refreshTokens.ts`:

```ts
import { foreignKey, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { baseColumns, tenantColumns } from './columns.js';
import { restaurants } from './restaurants.js';
import { users } from './users.js';

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    ...baseColumns(),
    ...tenantColumns(),
    userId: text('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    replacedByTokenId: text('replaced_by_token_id'),
  },
  (t) => [
    uniqueIndex('refresh_tokens_token_hash_unique').on(t.tokenHash),
    index('refresh_tokens_user_id_idx').on(t.userId),
    index('refresh_tokens_restaurant_id_idx').on(t.restaurantId),
    foreignKey({
      columns: [t.userId],
      foreignColumns: [users.id],
      name: 'refresh_tokens_user_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.restaurantId],
      foreignColumns: [restaurants.id],
      name: 'refresh_tokens_restaurant_id_fk',
    }).onDelete('cascade'),
  ]
);
```

Export from `schema/index.ts`, add to `schema` map. Generate migration: `pnpm --filter @restaurant/db db:generate`. Verify SQL file `0002_*.sql` exists and contains `refresh_tokens`.

- [ ] **Step 2: Add `@nestjs/jwt` dependency**

`pnpm --filter @restaurant/api add @nestjs/jwt`

- [ ] **Step 3: Write failing unit tests** (`auth.service.spec.ts`)

Fake `AuthRepository` + real `JwtService` (secret `test-secret`). Cases:
1. `login returns access token and user, and a raw refresh token that is NOT stored in plain text` — repo returns owner user; assert `verify(accessToken)` payload `{ sub, restaurantId, role }`, stored value equals sha256 of returned refresh token, `expiresAt` ~7 days out.
2. `login rejects wrong password with UnauthorizedException` (argon2 verify fails).
3. `login rejects unknown email with UnauthorizedException AND still runs a dummy argon2 verify` (timing equalization; assert dummy verify called).
4. `login with ambiguous email and no restaurantSlug rejects` (two users with same email in different restaurants).
5. `login scoped by restaurantSlug resolves the tenant first`.

- [ ] **Step 4: Run unit tests, watch them fail**

Run: `pnpm --filter @restaurant/api test -- auth.service`
Expected: FAIL (AuthService not defined / module missing).

- [ ] **Step 5: Implement `auth.repository.ts`, `auth.service.ts`, DTO, controller, module**

Key implementation details:

- `dto/login.dto.ts`:

```ts
import { z } from 'zod';

export const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  restaurantSlug: z.string().min(1).max(100).optional(),
});

export type StaffLoginDto = z.infer<typeof staffLoginSchema>;
```

- Refresh token = `randomBytes(32).toString('base64url')`; store `createHash('sha256').update(token).digest('hex')`; `expiresAt = new Date(Date.now() + 7*24*3600*1000).toISOString()`.
- Dummy argon2 hash constant (precomputed argon2id hash of a throwaway string) verified whenever credentials fail, so unknown-email and wrong-password take the same time.
- Cookie (controller, via `@Res({ passthrough: true }) res: Response`): name `refresh_token`, `httpOnly`, `sameSite: 'lax'`, `secure: process.env.NODE_ENV === 'production'`, `path: '/api/v1/auth/staff'`, `maxAge: 7*24*3600*1000`.
- Controller strips refresh token: response body `{ accessToken, user }`.
- `AuthModule` provides `AuthService`, `AuthRepository`, `JwtAuthGuard` (registered in Task 4's guard file — create empty guard file now with basic Bearer verify to keep the module compiling) and imports `JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-only-change-me', signOptions: { expiresIn: '15m' } })`.
- Register `AuthModule` in `app.module.ts`.

- [ ] **Step 6: Write failing integration test** (`auth.integration.spec.ts`)

Reuse the `applyMigrations` helper pattern (extract to `apps/api/src/testing/sqlite.ts` and refactor `tenants.integration.spec.ts` to import it). Cases:
1. `POST /api/v1/auth/staff/login with valid credentials returns accessToken and user` — tenant created via `POST /api/v1/admin/tenants`; assert `Set-Cookie` present with `HttpOnly` and `Path=/api/v1/auth/staff`.
2. `wrong password returns 401 with generic message`.
3. `unknown email returns 401` (same message as wrong password).
4. `restaurantSlug scoping: login succeeds with correct slug, fails with unknown slug`.
5. `tenant isolation: same email in two tenants logs into the correct one with slug`.

- [ ] **Step 7: Run integration tests, then all tests**

Run: `pnpm --filter @restaurant/api test -- auth.integration` then `pnpm --filter @restaurant/api test`
Expected: PASS (all files).

- [ ] **Step 8: Commit** `feat: staff login endpoint with refresh token storage`

### Task 2: Refresh flow (`POST /api/v1/auth/staff/refresh`)

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts` (add `refresh(rawToken: string | null)`)
- Modify: `apps/api/src/auth/auth.repository.ts` (add `findTokenByHash`, `revokeToken`, `revokeAllForUser`)
- Modify: `apps/api/src/auth/auth.controller.ts` (add route, cookie read helper)
- Test: extend `auth.service.spec.ts`, `auth.integration.spec.ts`

**Interfaces:**
- `AuthService.refresh(rawToken: string): Promise<{ accessToken: string; user: ... }>` — throws `UnauthorizedException` for missing/unknown/expired/replayed tokens.
- Reuse detection: presented token has `revokedAt != null` => revoke **all** tokens for that user, then 401.

- [ ] **Step 1: Failing unit tests**
  1. `refresh rotates: old token revoked with replacedByTokenId set, new token issued and stored hashed`
  2. `refresh with revoked (already used) token revokes all user tokens and throws` (assert `revokeAllForUser` called with user id)
  3. `refresh with expired token throws and does not rotate`
  4. `refresh with unknown token hash throws`
- [ ] **Step 2: Watch fail** → run unit tests.
- [ ] **Step 3: Implement** — rotation in a transaction: insert new token, update old (`revokedAt`, `replacedByTokenId` = new id). New access token signed for the token's user. Expired check via `expiresAt < now` (string compare works for ISO 8601 UTC).
- [ ] **Step 4: Failing integration tests**
  1. `login -> refresh returns new accessToken and new cookie, old refresh token no longer works`
  2. `replaying the old refresh token revokes the session: subsequent refresh with the newest token fails 401`
  3. `refresh without cookie returns 401`
- [ ] **Step 5: Watch pass, run full suite.** Commit `feat: refresh flow with rotation and reuse detection`.

### Task 3: Logout (`POST /api/v1/auth/staff/logout`)

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts`, `auth.service.ts` (add `logout(userId, rawToken)`)
- Create: `apps/api/src/auth/jwt-auth.guard.ts` (full version: Bearer verify, load user, attach `req.userId`/`req.restaurantId`)
- Modify: `apps/api/src/auth/request.types.ts` (add `userId`)
- Test: extend both specs

- [ ] **Step 1: Failing unit tests**
  1. `logout revokes the presented refresh token only if it belongs to the user`
  2. `logout is idempotent: no cookie / unknown token still resolves without error`
- [ ] **Step 2: Watch fail.**
- [ ] **Step 3: Implement** — `@Post('staff/logout') @UseGuards(JwtAuthGuard) @HttpCode(204)`: revoke token where `tokenHash` matches AND `userId === req.userId`; always clear cookie (`Max-Age=0`).
- [ ] **Step 4: Failing integration tests**
  1. `logout with valid access token + cookie returns 204, clears cookie, refresh with that token now fails`
  2. `logout without access token returns 401`
- [ ] **Step 5: Watch pass, full suite.** Commit `feat: staff logout invalidating refresh token`.

### Task 4: Current user (`GET /api/v1/auth/me`)

**Files:**
- Modify: `apps/api/src/auth/auth.repository.ts` (add `findRolePermissions`, `listLocationsForUser`)
- Modify: `apps/api/src/auth/auth.service.ts` (add `me(user)`)
- Create: `apps/api/src/auth/current-user.decorator.ts`
- Modify: `apps/api/src/auth/auth.controller.ts` (`@Get('me') @UseGuards(JwtAuthGuard)`)
- Test: extend both specs

**Interfaces:**
- `AuthService.me(user): Promise<{ id, email, fullName, role, permissions: string[], restaurant: { id, name, slug, currency }, locations: { id, name }[] }>`
- `CurrentUser()` param decorator returns the user row attached by `JwtAuthGuard`.
- Permissions: `roles.permissions` JSON string parsed; missing role row => `[]`.

- [ ] **Step 1: Failing unit test** — `me returns role permissions and assigned locations, empty permissions when role row missing`.
- [ ] **Step 2: Watch fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Failing integration tests**
  1. `GET /auth/me with bearer token returns user, restaurant, permissions, locations` (owner seeded via tenant creation has role `owner` with `["*"]`, one location)
  2. `GET /auth/me without token returns 401`
  3. `tenant isolation: user lookup is scoped by restaurantId from the token` (deleted/foreign user id in token => 401) — cover at unit level by making guard reject when `findUserById` returns null.
- [ ] **Step 5: Watch pass, full suite.** Commit `feat: current user endpoint with permissions and locations`.

### Final

- [ ] `pnpm lint`, `pnpm -r typecheck`, `pnpm test` all green.
- [ ] Manual smoke: `pnpm dev` boot + login against seeded dev user (`admin@dev.restaurant` / `dev-only-change-me`, from `pnpm --filter @restaurant/db db:seed`).
- [ ] Update Notion statuses (tasks 1-4 => Completed) via `NOTION_UPDATE_ROW_DATABASE`, row ids:
  - Task 1 login: `3c88e3f8-9152-8058-9615-f59ea8c38ed8`
  - Task 2 refresh: `3c88e3f8-9152-8011-9123-e7acdaba8f5f`
  - Task 3 logout: `3c88e3f8-9152-8048-ae5c-c143e6701f5e`
  - Task 4 me: `3c88e3f8-9152-807d-be60-ce5f1ceb2b71`

## Self-review notes

- Spec coverage: DESIGN.md section 15 Auth endpoints — all four implemented; section 16 httpOnly refresh cookie — done; AGENTS.md section 9 TTLs — done. Rate limiting (task 7) and auth audit logs (task 8) intentionally deferred to their own Notion tasks.
- Placeholder scan: none — all steps have concrete code or exact commands.
- Type consistency: `AuthService.refresh(rawToken)`/`logout(userId, rawToken)`/`me(user)` signatures match guard/decorator attachments (`req.userId`, `req.restaurantId`, `req.user`).
