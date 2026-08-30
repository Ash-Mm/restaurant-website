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
refresh tokens with token-theft detection, logout, and a current-user endpoint.

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
`GET /api/v1/health` returning `{ "status": "ok" }`, plus the Phase 1 tenant and location
endpoints:

| Method | Path                              | Purpose                                              |
| ------ | --------------------------------- | ---------------------------------------------------- |
| POST   | `/api/v1/admin/tenants`           | Create a restaurant (with owner role + account)      |
| GET    | `/api/v1/admin/settings`          | Read restaurant settings                             |
| PATCH  | `/api/v1/admin/settings`          | Update currency, timezone, language                  |
| PATCH  | `/api/v1/admin/settings/branding` | Update logo, brand color, receipt header/footer     |
| POST   | `/api/v1/admin/upload`            | Local logo upload (placeholder for S3)              |
| GET    | `/api/v1/admin/locations`         | List locations                                       |
| POST   | `/api/v1/admin/locations`         | Create a location                                    |
| GET    | `/api/v1/public/:slug/menu`       | Public tenant profile resolved by slug               |
| POST   | `/api/v1/auth/staff/login`        | Staff login (access token + httpOnly refresh cookie) |
| POST   | `/api/v1/auth/staff/refresh`      | Rotate refresh token, issue new access token         |
| POST   | `/api/v1/auth/staff/logout`       | Revoke refresh token, clear cookie                   |
| GET    | `/api/v1/auth/me`                 | Current user with role, permissions, locations       |

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

Runs the Jest suite (55 tests across 7 files): slug validation, tenant + location
guards, the JWT auth guard, the auth service (login, refresh rotation, reuse
detection, logout, current user), tenant/location CRUD integration, and
public-profile/branding integration. Migrations are applied to an in-memory
SQLite database per test file, so no local `dev.db` state is touched.

### Manual smoke test (API)

Start everything with `pnpm dev`, then exercise the endpoints (the API runs on
`:3000`). Replace `test-cafe` with any slug you create.

```bash
# Health
curl http://localhost:3000/api/v1/health

# Onboarding: create a tenant (restaurant + owner role + account + default branch)
curl -X POST http://localhost:3000/api/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Cafe","slug":"test-cafe","fullName":"Admin User",\
"email":"admin@test.com","password":"password123","currency":"EGP",\
"timezone":"Africa/Cairo","defaultLanguage":"en"}'

# Read settings (requires the tenant slug header)
curl http://localhost:3000/api/v1/admin/settings -H "x-restaurant-slug: test-cafe"

# Update settings
curl -X PATCH http://localhost:3000/api/v1/admin/settings \
  -H "x-restaurant-slug: test-cafe" -H "Content-Type: application/json" \
  -d '{"currency":"USD","timezone":"America/New_York"}'

# Update branding (logo URL, brand color, receipt text)
curl -X PATCH http://localhost:3000/api/v1/admin/settings/branding \
  -H "x-restaurant-slug: test-cafe" -H "Content-Type: application/json" \
  -d '{"brandColor":"#1A2B3C","receiptHeader":"Thanks for visiting!"}'

# Create + list locations
curl -X POST http://localhost:3000/api/v1/admin/locations \
  -H "x-restaurant-slug: test-cafe" -H "Content-Type: application/json" \
  -d '{"name":"Downtown","address":"123 Main St"}'
curl http://localhost:3000/api/v1/admin/locations -H "x-restaurant-slug: test-cafe"

# Public tenant resolution (no auth header needed)
curl http://localhost:3000/api/v1/public/test-cafe/menu

# Logo upload (save a small PNG as logo.png first)
curl -X POST http://localhost:3000/api/v1/admin/upload \
  -H "x-restaurant-slug: test-cafe" -F "file=@logo.png"

# Staff login (stores the refresh cookie in cookies.txt, prints the access token)
curl -s -X POST http://localhost:3000/api/v1/auth/staff/login \
  -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'

# Current user (requires the bearer access token from the login response)
curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer <ACCESS_TOKEN>"

# Rotate the refresh token (reads + rewrites the cookie in cookies.txt)
curl -s -X POST http://localhost:3000/api/v1/auth/staff/refresh \
  -b cookies.txt -c cookies.txt

# Reusing the previous refresh cookie now fails with 401 (rotation + reuse
# detection revokes the whole session)

# Logout (revokes the refresh token and clears the cookie)
curl -s -X POST http://localhost:3000/api/v1/auth/staff/logout \
  -b cookies.txt -c cookies.txt -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -w "%{http_code}\n" -o /dev/null
```

### Manual smoke test (frontend)

1. **POS** (`http://localhost:3002`)
   - Onboarding wizard (`/onboarding`): fill the two-step form and submit. You are
     redirected to `/locations` and the slug is stored in `localStorage`.
   - Locations (`/locations`): the created branch is listed; add another branch and
     confirm it appears.
   - Branding (`/branding`): existing logo/color/receipt text load on open; pick a
     color (the hex input stays in sync), upload a logo, edit receipt text, and Save.
     Refresh — values should persist.
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

## Phase 2 status (auth & RBAC — first four tasks)

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
- [x] Auth test suite: 55 tests across 7 files (unit + in-memory SQLite integration)

Remaining Phase 2 backlog (tracked in Notion): fine-grained permission guard,
guest order identity, auth rate limiting, auth audit logs, staff login UI.
