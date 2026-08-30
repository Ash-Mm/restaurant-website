# Phase 2 Backend RBAC Implementation Plan (Notion tasks 5-8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Phase 2 backend backlog: fine-grained permission guard (task 5), guest order identity with tracking tokens (task 6), rate limiting on the login endpoint (task 7), and audit logs for auth events (task 8).

**Architecture:** A `PermissionsGuard` composes after the existing `TenantGuard` + `JwtAuthGuard` and checks `roles.permissions` (JSON array, `*` wildcard) loaded from the database. Guest identity is a new tenant-scoped `customers` table plus an opaque SHA-256-hashed tracking token, same pattern as refresh tokens. Rate limiting uses `@nestjs/throttler` applied per-route (login only) to avoid breaking other endpoints and tests. Audit writes go through a reusable `AuditModule` into the existing `audit_logs` table.

**Tech Stack:** NestJS 11, `@nestjs/throttler` (new dep, approved), Drizzle ORM + SQLite (libsql), Zod DTOs via `ZodValidationPipe`, Jest + supertest (in-memory SQLite pattern from `apps/api/src/testing/sqlite.ts`).

**Spec:** AGENTS.md sections 4 (rules), 5 (process), 6 (structure), 7 (tenant isolation), 8 (location isolation), 9 (auth rules), 16 (testing); Notion Phase 2 tasks 5-8; README "Remaining Phase 2 backlog".

**Decisions confirmed with user:**
- Scope: backend tasks 5-8 only. Frontend tasks 9-10 (protected routes, staff login page) belong to a collaborator and get a handoff section in README.md.
- Branching: phase 2 auth work landed on `main` (squash commit `01123b6`); this work happens on `feat/phase2-backend-rbac` off `main`.
- Rate limiting: `@nestjs/throttler`.

## Global Constraints

- TypeScript strict mode; ESM (`type: module`) — relative imports end with `.js`.
- Never store tokens or passwords in plaintext: guest tracking tokens are stored as SHA-256 hashes only (AGENTS.md section 9).
- Never log passwords, tokens, or hashes (AGENTS.md section 4).
- Every new table needs `id`, `created_at`, `updated_at` (`baseColumns()`); tenant-scoped tables need `restaurant_id` (`tenantColumns()`).
- Never modify an applied migration; generate a new one with `pnpm --filter @restaurant/db db:generate`.
- Repository layer is the only place with database queries (AGENTS.md section 6).
- Tenant isolation: a guard must reject any user whose `restaurantId` differs from the restaurant being accessed.
- Role names must not be hard-coded in business logic; permissions come from the `roles` table (AGENTS.md section 9).
- Conventional commits: `feat: ...`, `test: ...`, `docs: ...`.

---

### Task 1 (Notion 5): PermissionsGuard + wiring

**Files:**
- Create: `apps/api/src/auth/permissions.util.ts`
- Create: `apps/api/src/auth/permissions.decorator.ts`
- Create: `apps/api/src/auth/permissions.guard.ts`
- Create: `apps/api/src/auth/permissions.guard.spec.ts`
- Modify: `apps/api/src/auth/auth.service.ts` (reuse `parsePermissions` from the util)
- Modify: `apps/api/src/tenants/settings.controller.ts` (guards + per-route permissions)
- Modify: `apps/api/src/tenants/upload.controller.ts` (guards + permission)
- Modify: `apps/api/src/locations/locations.controller.ts` (guards + per-route permissions)
- Modify: `apps/api/src/tenants/tenants.integration.spec.ts` (authenticate existing tests)
- Modify: `apps/api/src/locations/*` if tests live there (they live in tenants.integration.spec.ts)
- Test: `apps/api/src/auth/permissions.guard.spec.ts`, `apps/api/src/tenants/tenants.integration.spec.ts`

**Interfaces:**
- `RequirePermissions(...permissions: string[])` — route/controller decorator, metadata key `requiredPermissions`.
- `hasPermission(granted: string[], required: string): boolean` — `true` iff `granted` contains `*` or the exact permission.
- `parsePermissions(json: string | null): string[]` — safe JSON array of strings.
- `PermissionsGuard` — after `TenantGuard` + `JwtAuthGuard`: 401 if no `req.user`, 403 on cross-tenant mismatch (`user.restaurantId !== req.restaurantId`), 403 when permissions insufficient, `true` when no metadata.

Permission strings used in this phase: `settings:read`, `settings:write`, `locations:read`, `locations:write`.

- [ ] **Step 1: Unit test first** (`permissions.guard.spec.ts`) — cases:
  - `hasPermission(['*'], 'locations:write')` → true; `hasPermission(['locations:read'], 'locations:read')` → true; `hasPermission(['locations:read'], 'locations:write')` → false.
  - Guard with no metadata → true (no DB call).
  - Guard with user from another restaurant than `req.restaurantId` → `ForbiddenException` (cross-tenant).
  - Guard with role permissions `['locations:read']` requiring `['locations:write']` → `ForbiddenException`.
  - Guard with `['*']` requiring `['settings:write']` → true.
- [ ] **Step 2: Run** `pnpm --filter @restaurant/api test -- permissions.guard` → expect FAIL (file missing).
- [ ] **Step 3: Implement** decorator + util + guard (code above).
- [ ] **Step 4: Wire controllers**
  - `SettingsController`: `@UseGuards(TenantGuard, JwtAuthGuard, PermissionsGuard)`; GET → `@RequirePermissions('settings:read')`; both PATCHes → `@RequirePermissions('settings:write')`.
  - `UploadController`: `@UseGuards(TenantGuard, JwtAuthGuard, PermissionsGuard)` + `@RequirePermissions('settings:write')`.
  - `LocationsController`: same pattern; GET → `locations:read`, POST/PATCH → `locations:write`.
  - `TenantsController` stays open (onboarding must work unauthenticated).
- [ ] **Step 5: Refactor** `auth.service.ts` to import `parsePermissions` from `permissions.util.ts` (delete its local copy).
- [ ] **Step 6: Update integration tests** — helper `createTenantAndLogin(slug, email)` in `tenants.integration.spec.ts`: POST `/api/v1/admin/tenants` then POST `/api/v1/auth/staff/login`; attach `Authorization: Bearer <token>` + `X-Restaurant-Slug` to admin calls. Add tests: admin settings without bearer → 401; cross-tenant token vs slug → 403; limited role (`cashier`, permissions `[]`, user inserted via `getDb()`) → 403 on location create; owner (`['*']`) → 201.
- [ ] **Step 7: Run** full suite `pnpm --filter @restaurant/api test` → PASS.
- [ ] **Step 8: Commit** `feat: fine-grained permission guard on admin endpoints`

### Task 2 (Notion 6): Guest order identity

**Files:**
- Create: `packages/db/src/schema/customers.ts`
- Modify: `packages/db/src/schema/index.ts` (export + schema map)
- Create: `packages/db/drizzle/0003_*.sql` (generated)
- Create: `apps/api/src/customers/customers.module.ts`
- Create: `apps/api/src/customers/customers.service.ts`
- Create: `apps/api/src/customers/customers.repository.ts`
- Create: `apps/api/src/customers/customers.controller.ts`
- Create: `apps/api/src/customers/dto/guest-session.dto.ts`
- Test: `apps/api/src/customers/customers.integration.spec.ts`

**Interfaces:**
- `CustomersService.createGuestSession(restaurantId, profile?)` → `{ customerId, trackingToken }` (raw token returned once; only `sha256(token)` stored in `tracking_token_hash`).
- `CustomersService.resolveTrackingToken(restaurantId, rawToken)` → customer row or `null` (expired/unknown/other-tenant all → `null`).
- Endpoints: `POST /api/v1/public/:slug/guest-session` → 201 `{ customerId, trackingToken }`; `POST /api/v1/public/guest/resolve` with `{ restaurantSlug, trackingToken }` → 200 `{ customer: { id, name, email, phone } }` or 401 `Invalid tracking token`.
- Schema `customers`: `baseColumns() + tenantColumns() + name?, email?, phone?, tracking_token_hash?, tracking_expires_at?` (ISO strings, nullable); index on `restaurant_id`; unique-ish index on `tracking_token_hash`.

Constants: `GUEST_TRACKING_TTL_DAYS = 30`.

- [ ] **Step 1: Schema + migration** (`customers.ts` above), export, `pnpm --filter @restaurant/db db:generate -- --name add_customers`, inspect generated SQL.
- [ ] **Step 2: Integration test first** (`customers.integration.spec.ts`): create session → 201 with customerId + token; resolve with token → 200 + profile; resolve with wrong token → 401; resolve after inserting an expired `tracking_expires_at` row → 401; tenant isolation: token issued under slug A resolves 401 under slug B; profile fields (name/email/phone) round-trip.
- [ ] **Step 3: Run** `pnpm --filter @restaurant/api test -- customers` → FAIL.
- [ ] **Step 4: Implement** repository (insert customer, find by hash+restaurant), service (hash via `createHash('sha256')`, expiry check, token via `randomBytes(32).toString('base64url')`), controller with Zod DTOs (`guestSessionSchema: { name?, email?, phone? }`, `resolveGuestSchema: { restaurantSlug, trackingToken }`), module; register `CustomersModule` in `app.module.ts`.
- [ ] **Step 5: Run** `pnpm --filter @restaurant/api test -- customers` → PASS.
- [ ] **Step 6: Commit** `feat: guest order identity with hashed tracking tokens`

### Task 3 (Notion 7): Rate limiting on auth endpoints

**Files:**
- Modify: `apps/api/package.json` (`@nestjs/throttler`)
- Modify: `apps/api/src/auth/auth.module.ts` (import `ThrottlerModule.forRoot`)
- Modify: `apps/api/src/auth/auth.controller.ts` (`ThrottlerGuard` + `@Throttle` on login)
- Test: `apps/api/src/auth/auth.integration.spec.ts` (new describe with its own app)

**Interfaces:** login route allows 5 requests / 60s per IP; 6th returns 429 (`ThrottlerException`). No global guard — other endpoints unaffected.

- [ ] **Step 1:** `pnpm --filter @restaurant/api add @nestjs/throttler`
- [ ] **Step 2: Test first** — separate describe creating its OWN app instance (fresh throttler storage; DB is shared-cache in-memory): 6 rapid logins with valid creds → first 5 pass, 6th → 429. Run → FAIL.
- [ ] **Step 3: Implement** — `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])` in `AuthModule`; on `login`: `@UseGuards(ThrottlerGuard)` + `@Throttle({ default: { limit: 5, ttl: 60_000 } })`.
- [ ] **Step 4: Run** `pnpm --filter @restaurant/api test -- auth` → PASS (existing tests unaffected: they use the other app instance).
- [ ] **Step 5: Commit** `feat: rate limit staff login endpoint`

### Task 4 (Notion 8): Audit logs for auth events

**Files:**
- Create: `apps/api/src/audit/audit.module.ts`
- Create: `apps/api/src/audit/audit.service.ts`
- Create: `apps/api/src/audit/audit.repository.ts`
- Modify: `apps/api/src/auth/auth.module.ts` (import + export AuditModule)
- Modify: `apps/api/src/auth/auth.service.ts` (inject + emit events)
- Modify: `apps/api/src/auth/auth.service.spec.ts` (mock audit dependency)
- Test: `apps/api/src/auth/auth.integration.spec.ts` (audit rows asserted)

**Interfaces:**
- `AuditService.log(entry: { restaurantId: string; userId?: string | null; action: string; entityType: string; entityId?: string | null; metadata?: Record<string, unknown> }): Promise<void>` — best-effort: failures are swallowed (logged to stderr) so auth flows never break on audit errors.
- Events: `auth.login.success` (user known), `auth.login.failure` (only when restaurant is resolvable — `restaurant_id` is NOT NULL), `auth.refresh.reuse_detected` (from the token row), `auth.logout`.
- Metadata never contains passwords, tokens, or hashes. Email may be logged.

- [ ] **Step 1: Test first** — in `auth.integration.spec.ts`: after successful login, `audit_logs` contains `auth.login.success` for the user; wrong password → `auth.login.failure`; replaying a rotated token → `auth.refresh.reuse_detected` + all sessions revoked; logout → `auth.logout`. Assert metadata has no `password` and no raw token substring. Run → FAIL.
- [ ] **Step 2: Implement** module/service/repository; inject `AuditService` into `AuthService` at login success/failure, refresh reuse, logout.
- [ ] **Step 3:** Update `auth.service.spec.ts` mock provider list (add audit mock).
- [ ] **Step 4: Run** `pnpm --filter @restaurant/api test` → PASS.
- [ ] **Step 5: Commit** `feat: audit logging for auth events`

### Task 5: README (frontend handoff for tasks 9-10 + phase status)

**Files:**
- Modify: `README.md`

Content:
- New section "Frontend handoff: Phase 2 tasks 9 & 10 (POS login UI)" describing exactly what the collaborator builds, the API contract, constraints, and acceptance criteria.
- Phase 2 status checkboxes for tasks 5-8; remove "Remaining Phase 2 backlog" line for completed items.
- Update smoke-test section: admin endpoints now require `Authorization: Bearer <accessToken>`; login example first.
- Update endpoint table (unchanged paths; note auth requirement).

Handoff section must state:
- Branch: `feat/pos-login-ui` off `main`. Only touch `apps/pos/`. Never modify `apps/api/` or `packages/db/`.
- Task 10 — login page `apps/pos/src/app/login/page.tsx`: RHF + Zod form (email, password, optional restaurantSlug), POST `/api/v1/auth/staff/login`, keep `accessToken` in memory only (never localStorage), generic 401 error message.
- Task 9 — protected routes: `useMe` TanStack Query on `GET /api/v1/auth/me`; 401 → redirect `/login?returnUrl=<path>`; on mount and after login, navigate back to `returnUrl`; auto `POST /api/v1/auth/staff/refresh` (cookie-based) when access token expired; logout button POST `/api/v1/auth/staff/logout` then redirect to `/login`.
- Contract: access token TTL 15 min; refresh cookie httpOnly path `/api/v1/auth/staff`; CORS already allows `http://localhost:3002`; seed credentials `admin@dev.restaurant` / `dev-only-change-me` (or `SEED_ADMIN_PASSWORD`).
- Acceptance criteria: visiting `/locations` unauthenticated redirects to login; after login returns to `/locations`; refresh persists session across 15-min expiry; logout clears session.

- [ ] **Step 1:** Edit README.
- [ ] **Step 2: Commit** `docs: phase 2 backend status + frontend handoff for tasks 9-10`

### Task 6: Review + verify + ship

- [ ] **Step 1:** `pnpm lint` → clean.
- [ ] **Step 2:** `pnpm typecheck` → clean.
- [ ] **Step 3:** `pnpm test` → all suites pass.
- [ ] **Step 4:** Manual smoke: `pnpm dev`, create tenant → login → settings with bearer → 403 with wrong-tenant token → guest session round-trip → 429 after 6 logins → audit rows in DB.
- [ ] **Step 5:** Self-review against AGENTS.md sections 4/7/9 (no secret logging, tenant isolation, hashed tokens at rest).
- [ ] **Step 6:** Push branch; `gh pr create` → `main`; set Notion tasks 5-8 → Completed (9-10 stay Not Started, collaborator owns them).
