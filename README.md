# Restaurant Platform

A multi-tenant restaurant ordering and operations platform (template). One restaurant
owner can operate multiple locations with a public storefront, online ordering, a POS/KDS
staff console, kitchen display, inventory, and reporting.

This repository contains the **Phase 0** foundation, **Phase 1** features, and **Phase 2**
features. Phase 0 is the workspace tooling, a local SQLite database (with Drizzle ORM), and
the application scaffolds (API + two Next.js apps + a shared UI library). Phase 1 adds the
tenant and location backbone: tenant context and location access guards, URL-safe slug
validation, restaurant creation with an owner account, configurable restaurant settings,
location CRUD, public tenant resolution for the storefront, branding settings, and the POS
admin screens (onboarding wizard, location management, branding). Phase 2 adds staff
authentication: email/password login with Argon2id, short-lived JWT access tokens, rotating
refresh tokens with token-theft detection, logout, a current-user endpoint, a fine-grained
permission guard on admin endpoints, guest order identity with hashed tracking tokens,
rate limiting on login, and audit logging for auth events.

## Tech stack

| Concern      | Technology                                              |
| ------------ | ------------------------------------------------------- |
| Language     | TypeScript (strict)                                     |
| Backend      | NestJS                                                  |
| Frontend     | Next.js (App Router) + React                            |
| Workspace    | pnpm workspaces                                         |
| UI           | Tailwind CSS + shadcn/ui-style components               |
| Server state | TanStack Query                                          |
| ORM          | Drizzle ORM                                             |
| Auth         | JWT (`@nestjs/jwt`) + Argon2id (`@node-rs/argon2`)      |
| Local DB     | SQLite (`@libsql/client`)                               |
| Lint/Format  | ESLint (flat config) + Prettier                         |

## Prerequisites

- Node.js >= 22
- pnpm >= 11 (`npm i -g pnpm` or use Corepack)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Create your local env (safe template, no secrets)
cp .env.example .env

# 3. Build the shared packages so apps can resolve them from dist
pnpm --filter "@restaurant/*" build

# 4. Create the database schema (generates + applies the SQLite migration)
pnpm --filter @restaurant/db db:migrate

# 5. Seed a development restaurant, owner account, and branch
pnpm --filter @restaurant/db db:seed
```

The database lives at `packages/db/dev.db` (gitignored). The seed creates:

- restaurant `dev-restaurant` (slug)
- location `Main Branch`
- role `owner` (full permissions)
- user `admin@dev.restaurant` with password from `SEED_ADMIN_PASSWORD`
  (defaults to `dev-only-change-me`)

## Running the apps

### All apps at once

From the repo root, build the shared packages and start all three dev servers
(API on 3000, storefront on 3001, POS on 3002) in a single terminal:

```bash
pnpm dev
```

### Individual apps

Each app can also be run independently. Shared packages must be built first
(step 3 above). The API runs via the NestJS CLI (`nest start --watch`), which
transpiles with decorator metadata so dependency injection works at runtime.

| App         | Package              | Port | Command                                   |
| ----------- | -------------------- | ---- | ----------------------------------------- |
| API         | `@restaurant/api`    | 3000 | `pnpm --filter @restaurant/api dev`       |
| Storefront  | `@restaurant/storefront` | 3001 | `pnpm --filter @restaurant/storefront dev` |
| POS / KDS   | `@restaurant/pos`    | 3002 | `pnpm --filter @restaurant/pos dev`       |

The API exposes a global prefix `/api/v1`. It ships a health check at
`GET /api/v1/health` returning `{ "status": "ok" }`, plus the Phase 1/2 tenant, location,
and auth endpoints. **All `/admin/*` endpoints except tenant creation now require a
`Authorization: Bearer <accessToken>` header** in addition to `X-Restaurant-Slug`:

| Method | Path                               | Auth            | Purpose                                              |
| ------ | ---------------------------------- | --------------- | ---------------------------------------------------- |
| POST   | `/api/v1/admin/tenants`            | — (open)        | Create a restaurant (with owner role + account)      |
| GET    | `/api/v1/admin/settings`           | Bearer + slug   | Read restaurant settings (`settings:read`)           |
| PATCH  | `/api/v1/admin/settings`           | Bearer + slug   | Update currency, timezone, language (`settings:write`) |
| PATCH  | `/api/v1/admin/settings/branding`  | Bearer + slug   | Update logo, brand color, receipt text (`settings:write`) |
| POST   | `/api/v1/admin/upload`             | Bearer + slug   | Local logo upload (`settings:write`)                 |
| GET    | `/api/v1/admin/locations`          | Bearer + slug   | List locations (`locations:read`)                    |
| POST   | `/api/v1/admin/locations`          | Bearer + slug   | Create a location (`locations:write`)                |
| PATCH  | `/api/v1/admin/locations/:id`      | Bearer + slug   | Update a location (`locations:write`)                |
| GET    | `/api/v1/public/:slug/menu`        | — (public)      | Public tenant profile resolved by slug               |
| POST   | `/api/v1/public/:slug/guest-session` | — (public)    | Guest checkout identity: issues a tracking token     |
| POST   | `/api/v1/public/guest/resolve`     | — (public)      | Resolve a guest tracking token to a customer profile |
| POST   | `/api/v1/auth/staff/login`         | — (rate limited)| Staff login (access token + httpOnly refresh cookie) |
| POST   | `/api/v1/auth/staff/refresh`       | refresh cookie  | Rotate refresh token, issue new access token         |
| POST   | `/api/v1/auth/staff/logout`        | Bearer + cookie | Revoke refresh token, clear cookie                   |
| GET    | `/api/v1/auth/me`                  | Bearer          | Current user with role, permissions, locations       |

> **Environment:** the API auto-loads the repo-root `.env` at startup, so
> `DATABASE_URL`, `CORS_ORIGIN`, `PORT`, `JWT_SECRET`, etc. are read from there.
> `CORS_ORIGIN` is a comma-separated list of allowed browser origins (defaults to
> `http://localhost:3000`); it already includes `3001` (storefront) and `3002` (POS).
> The database defaults to `file:./packages/db/dev.db` (seeded in step 5).

### Staff authentication (Phase 2)

- Passwords are hashed with **Argon2id**; login failures return a generic
  `401 Invalid email or password` (unknown email and wrong password are
  indistinguishable, and a dummy hash verification equalizes response timing).
- **Access token:** HS256 JWT with `{ sub, restaurantId, role }`, TTL 15 minutes,
  signed with `JWT_SECRET`. The frontend keeps it in memory (never localStorage).
- **Refresh token:** an opaque random 32-byte token delivered as an `httpOnly`
  cookie scoped to `/api/v1/auth/staff` (`SameSite=Lax`, `Secure` in production).
  Only its SHA-256 hash is stored in the `refresh_tokens` table (7-day TTL).
- **Rotation + reuse detection:** every refresh rotates the token (the old one is
  revoked and linked to its successor in a single transaction). Replaying an
  already-used token revokes **all** sessions for that user.
- Because staff emails are unique per restaurant (not globally), login accepts an
  optional `restaurantSlug` to disambiguate; without it, an ambiguous email fails
  closed with 401.
- `/auth/me` resolves the user **scoped by the `restaurantId` inside the signed
  token** — never from client input — and returns role permissions (from the
  `roles` table) plus assigned locations.
- **Permission guard (Notion task 5):** admin endpoints declare the permissions
  they require (e.g. `@RequirePermissions('locations:write')`); `PermissionsGuard`
  loads the caller's role permissions from the `roles` table (JSON array, `*`
  wildcard) and enforces them. It also rejects any request where the token's
  restaurant does not match the `X-Restaurant-Slug` tenant (403 cross-tenant).
  Role names are never hard-coded — only permission strings are.
- **Guest order identity (Notion task 6):** `POST /public/:slug/guest-session`
  creates a customer row for guest checkout and returns an opaque tracking token
  **once**; only its SHA-256 hash is stored (30-day TTL, revocable).
  `POST /public/guest/resolve` exchanges `{ restaurantSlug, trackingToken }` for
  the customer profile. Orders (Phase 4) will reference this customer.
- **Rate limiting (Notion task 7):** `POST /auth/staff/login` allows **5 requests
  per minute per IP** (`@nestjs/throttler`); the 6th returns 429. Other endpoints
  are not throttled. Override in tests via `LOGIN_RATE_LIMIT`.
- **Audit logs (Notion task 8):** auth events are recorded in `audit_logs` —
  `auth.login.success`, `auth.login.failure` (when the restaurant is resolvable),
  `auth.refresh.reuse_detected`, `auth.logout`. Metadata is scrubbed of keys
  matching `password|token|secret|hmac|authorization|cookie`; audit failures never
  break the auth flow.

### Frontend handoff: Phase 2 tasks 9 & 10 (POS login UI) — for the frontend collaborator

> The backend for these two tasks is complete and merged. **You only touch
> `apps/pos/`.** Do **not** modify `apps/api/` or `packages/db/` — if something
> seems missing there, open an issue instead.

**Setup:** branch `feat/pos-login-ui` off latest `main`. Run `pnpm install`,
`pnpm --filter "@restaurant/*" build`, `pnpm --filter @restaurant/db db:migrate`,
`pnpm --filter @restaurant/db db:seed`, then `pnpm dev` (POS on
`http://localhost:3002`, API on `:3000`). Seed login: `admin@dev.restaurant` /
`dev-only-change-me` (or `SEED_ADMIN_PASSWORD` from `.env`).

**Task 10 — staff login page** (`apps/pos/src/app/login/page.tsx`):

- Email + password form using **React Hook Form + Zod** (mirror the existing
  onboarding/branding form style in `apps/pos/src/app/`), plus an **optional**
  `restaurantSlug` field (only needed if the same email exists in several
  restaurants; leave it hidden behind a "Advanced" toggle).
- Submit via a TanStack Query mutation to `POST /api/v1/auth/staff/login` with
  JSON `{ email, password, restaurantSlug? }`.
- Response: `{ accessToken, user: { id, email, fullName, role } }`. Keep
  `accessToken` **in memory only** (module-level variable in
  `apps/pos/src/lib/auth.ts`) — **never localStorage/sessionStorage** (repo rule).
  The refresh token arrives as an httpOnly cookie scoped to `/api/v1/auth/staff`;
  the browser handles it automatically — do not read or store it.
- Show a single generic error on 401: "Invalid email or password". On 429 show
  "Too many attempts, try again in a minute". On success navigate to
  `returnUrl` from the query string (default `/locations`).
- Also add a logout button (in the existing admin layout/header):
  `POST /api/v1/auth/staff/logout` with the bearer token, then clear the
  in-memory token and redirect to `/login`.

**Task 9 — protected route handling** (`apps/pos/src/lib/auth.ts` + a
`useRequireAuth` hook):

- On mount of any admin page (`/locations`, `/branding`, …) call
  `GET /api/v1/auth/me` with `Authorization: Bearer <accessToken>`.
  - 401 with **no** in-memory token → redirect to
    `/login?returnUrl=<current path>`.
  - 401 **with** a token → the access token likely expired (15 min TTL): call
    `POST /api/v1/auth/staff/refresh` once; on success store the new
    `accessToken` and retry `/auth/me`; on failure redirect to login.
- `POST /api/v1/auth/staff/login` is rate limited to 5/min per IP — do not
  retry it automatically.
- The `/auth/me` response `{ permissions: string[], locations: [...], role }`
  should be cached via TanStack Query (e.g. `queryKey: ['me']`) and can hide
  UI the caller lacks permissions for (owner seed role has `['*']`).

**Suggested files:**

```txt
apps/pos/src/app/login/page.tsx      # login form (task 10)
apps/pos/src/lib/auth.ts             # token store + fetch wrapper with refresh-on-401
apps/pos/src/hooks/useRequireAuth.ts # redirect + /auth/me query (task 9)
apps/pos/src/lib/api.ts              # extend existing API helper with auth headers
```

**API contract recap:** base URL `http://localhost:3000/api/v1` (see
`packages/config`); CORS already allows `http://localhost:3002`; refresh cookie
is `Path=/api/v1/auth/staff` so `/auth/staff/refresh` and `/auth/staff/logout`
work from the browser but `/auth/me` never needs it.

**Acceptance criteria:**

1. Visiting `http://localhost:3002/locations` signed out redirects to
   `/login?returnUrl=%2Flocations`.
2. Logging in with the seed account returns to `/locations` and shows data.
3. Waiting >15 min (or restarting the API to simulate expiry) then clicking
   something silently refreshes the access token instead of logging out.
4. Logout returns to `/login`, and `/locations` is protected again.
5. `pnpm lint` and `pnpm typecheck` pass; no changes outside `apps/pos/`.

## Useful scripts

```bash
pnpm dev             # build shared packages + run all 3 apps (api, storefront, pos)
pnpm lint            # ESLint across the workspace
pnpm typecheck       # tsc --noEmit for every package that defines it
pnpm test            # run API test suite (Jest)
pnpm --filter "@restaurant/*" build   # build all shared packages to dist/
pnpm build           # build every package/app recursively
```

Database (in `@restaurant/db`):

```bash
pnpm --filter @restaurant/db db:generate   # create a new migration from schema
pnpm --filter @restaurant/db db:migrate    # apply pending migrations
pnpm --filter @restaurant/db db:seed       # seed dev data (idempotent)
pnpm --filter @restaurant/db db:studio     # open Drizzle Studio
```

## Project structure

```
apps/
  api/          # NestJS API (health, auth, guards, tenant & location modules)
  storefront/   # Next.js public ordering site (port 3001) + tenant slug middleware
  pos/          # Next.js POS / KDS / Admin console (port 3002) + admin screens
packages/
  db/           # Drizzle schema, client, migrations, seed
  ui/           # Shared components (cn util, Button) + Tailwind
  config/       # Shared typed config (API/public URLs)
  contracts/    # Shared types + URL-safe slug validation
  printer/      # Printing types (placeholder for now)
```

## Conventions

- **Money** is stored as integer minor units; **rates** as integer basis points.
- Every table has `id` (UUID), `created_at`, `updated_at`.
- Tenant-scoped tables carry `restaurant_id`; location-scoped tables also carry
  `location_id`.
- Shared packages build to `dist/` and are consumed as built JS; they are not run
  from source in this Phase 0 setup.

## Testing

### Automated tests

```bash
pnpm --filter @restaurant/api test
```

Runs the Jest suite (85 tests across 9 files): slug validation, tenant + location
guards, the JWT auth guard, the permissions guard, the auth service (login,
refresh rotation, reuse detection, logout, current user), guest tracking tokens,
login rate limiting, auth audit logs, tenant/location CRUD integration, and
public-profile/branding integration. Migrations are applied to an in-memory
SQLite database per test file, so no local `dev.db` state is touched.

### Manual smoke test (API)

Start everything with `pnpm dev`, then exercise the endpoints (the API runs on
`:3000`). Replace `test-cafe` with any slug you create.

```bash
# Health
curl http://localhost:3000/api/v1/health

# Onboarding: create a tenant (restaurant + owner role + account + default branch).
# This is the only admin endpoint that works without a bearer token.
curl -X POST http://localhost:3000/api/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Cafe","slug":"test-cafe","fullName":"Admin User",\
"email":"admin@test.com","password":"password123","currency":"EGP",\
"timezone":"Africa/Cairo","defaultLanguage":"en"}'

# Staff login FIRST (rate limited to 5/min per IP): stores the refresh cookie
# in cookies.txt and prints the access token.
curl -s -X POST http://localhost:3000/api/v1/auth/staff/login \
  -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'
# → {"accessToken":"...","user":{...}} — copy it into $TOKEN, e.g.:
# TOKEN="<paste accessToken here>"   (bash/zsh)

# Current user (requires the bearer access token from the login response)
curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"

# Read settings (now requires BOTH the bearer token and the tenant slug header)
curl http://localhost:3000/api/v1/admin/settings \
  -H "Authorization: Bearer $TOKEN" -H "x-restaurant-slug: test-cafe"

# Update settings
curl -X PATCH http://localhost:3000/api/v1/admin/settings \
  -H "Authorization: Bearer $TOKEN" -H "x-restaurant-slug: test-cafe" \
  -H "Content-Type: application/json" \
  -d '{"currency":"USD","timezone":"America/New_York"}'

# Update branding (logo URL, brand color, receipt text)
curl -X PATCH http://localhost:3000/api/v1/admin/settings/branding \
  -H "Authorization: Bearer $TOKEN" -H "x-restaurant-slug: test-cafe" \
  -H "Content-Type: application/json" \
  -d '{"brandColor":"#1A2B3C","receiptHeader":"Thanks for visiting!"}'

# Create + list locations
curl -X POST http://localhost:3000/api/v1/admin/locations \
  -H "Authorization: Bearer $TOKEN" -H "x-restaurant-slug: test-cafe" \
  -H "Content-Type: application/json" \
  -d '{"name":"Downtown","address":"123 Main St"}'
curl http://localhost:3000/api/v1/admin/locations \
  -H "Authorization: Bearer $TOKEN" -H "x-restaurant-slug: test-cafe"

# Public tenant resolution (no auth header needed)
curl http://localhost:3000/api/v1/public/test-cafe/menu

# Guest checkout identity: open a session, then resolve the tracking token
curl -X POST http://localhost:3000/api/v1/public/test-cafe/guest-session \
  -H "Content-Type: application/json" -d '{"name":"Walk-in"}'
# → {"customerId":"...","trackingToken":"..."} — then:
curl -X POST http://localhost:3000/api/v1/public/guest/resolve \
  -H "Content-Type: application/json" \
  -d '{"restaurantSlug":"test-cafe","trackingToken":"<trackingToken>"}'

# Logo upload (save a small PNG as logo.png first)
curl -X POST http://localhost:3000/api/v1/admin/upload \
  -H "Authorization: Bearer $TOKEN" -H "x-restaurant-slug: test-cafe" \
  -F "file=@logo.png"

# Rotate the refresh token (reads + rewrites the cookie in cookies.txt)
curl -s -X POST http://localhost:3000/api/v1/auth/staff/refresh \
  -b cookies.txt -c cookies.txt

# Reusing the previous refresh cookie now fails with 401 (rotation + reuse
# detection revokes the whole session and writes an audit_logs row)

# Logout (revokes the refresh token and clears the cookie)
curl -s -X POST http://localhost:3000/api/v1/auth/staff/logout \
  -b cookies.txt -c cookies.txt -H "Authorization: Bearer $TOKEN" \
  -w "%{http_code}\n" -o /dev/null

# Rate limiting: the 6th login within a minute from one IP gets a 429
for i in 1 2 3 4 5 6; do \
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:3000/api/v1/auth/staff/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'; done
```

### Manual smoke test (frontend)

1. **POS** (`http://localhost:3002`)
   - Onboarding wizard (`/onboarding`): fill the two-step form and submit. You are
     redirected to `/locations` and the slug is stored in `localStorage`.
   - Locations (`/locations`) and Branding (`/branding`): **these require the
     staff login UI (Phase 2 tasks 9 & 10, in progress)** — until it lands they
     will show 401 errors when the API rejects unauthenticated calls. Verify the
     backend behavior with the curl smoke test above instead.
2. **Storefront** (`http://localhost:3001/r/test-cafe`): the public tenant profile
   resolves by slug (set via the `/r/:slug` middleware).

> The API auto-applies pending migrations on boot (`OnModuleInit` → `runMigrations`),
> so the local `dev.db` stays in sync with the schema without a manual step.

## Phase 0 status

- [x] DevOps tooling (pnpm workspace, strict TS, ESLint, Prettier, `.env.example`)
- [x] Local SQLite database + Drizzle client
- [x] Drizzle schema foundation (shared columns/money/basis-points helpers)
- [x] Core tables: restaurants, locations, users, roles, user_locations, settings, audit_logs
- [x] Migration workflow (generate + migrate)
- [x] Seed dev restaurant, owner, branch
- [x] NestJS API scaffold (health + global validation)
- [x] Next.js storefront scaffold
- [x] Next.js POS/KDS/admin scaffold
- [x] Shared UI package (Tailwind + shadcn-style Button)

## Phase 1 status (tenant & locations)

- [x] Tenant context guard (`restaurant id` resolved + verified from auth)
- [x] Location access guard (verifies user access to requested `location id`)
- [x] URL-safe slug validation in `@restaurant/contracts`
- [x] Restaurant creation endpoint (creates restaurant + owner role + owner account)
- [x] Restaurant settings (configurable currency, timezone, language)
- [x] Location CRUD (create, list, enable/disable branches)
- [x] Public tenant resolution (`/api/v1/public/:slug/menu` + storefront `/r/:slug` middleware)
- [x] Branding settings (logo upload, brand color, receipt header/footer)
- [x] POS admin screens: onboarding wizard, location management, branding
- [x] API test suite (18 integration/unit tests across guards, tenant, location, public)

## Phase 2 status (auth & RBAC)

- [x] Staff login endpoint (`POST /auth/staff/login`): Argon2id verification,
      15-minute HS256 access token, opaque 7-day refresh token
- [x] `refresh_tokens` table + migration — only SHA-256 hashes stored, never
      plaintext (AGENTS.md rule)
- [x] Refresh flow with rotation: old token revoked and linked to its successor
      atomically; new access token + cookie issued on every refresh
- [x] Token-theft reuse detection: replaying a rotated token revokes all sessions
      for that user
- [x] Logout endpoint: revokes the presented refresh token (only if it belongs to
      the caller), clears the cookie, idempotent
- [x] Current-user endpoint (`GET /auth/me`): user + restaurant + role permissions
      + assigned locations, tenant-scoped from the signed token
- [x] Fine-grained permission guard (Notion task 5): `@RequirePermissions(...)`
      + `PermissionsGuard` on all admin endpoints; cross-tenant access → 403
- [x] Guest order identity (Notion task 6): `customers` table + hashed guest
      tracking tokens (`/public/:slug/guest-session`, `/public/guest/resolve`)
- [x] Login rate limiting (Notion task 7): 5 requests/min per IP on
      `POST /auth/staff/login` via `@nestjs/throttler`
- [x] Auth audit logs (Notion task 8): login success/failure, refresh reuse,
      logout recorded in `audit_logs` with secret-scrubbed metadata
- [ ] Staff login UI + protected POS routes (Notion tasks 9 & 10) — assigned to
      a collaborator, see "Frontend handoff" above
- [x] API test suite: 85 tests across 9 files (unit + in-memory SQLite integration)

> Note for the collaborator: until tasks 9 & 10 land, the POS admin screens
> (`/locations`, `/branding`) return 401 because the API now requires a bearer
> token — that is expected, not a regression.
