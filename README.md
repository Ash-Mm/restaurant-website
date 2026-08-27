# Restaurant Platform

A multi-tenant restaurant ordering and operations platform (template). One restaurant
owner can operate multiple locations with a public storefront, online ordering, a POS/KDS
staff console, kitchen display, inventory, and reporting.

This repository is the **Phase 0** foundation: workspace tooling, a local SQLite database
(with Drizzle ORM), and the application scaffolds (API + two Next.js apps + a shared UI
library). Business features are built in later phases.

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

Each app is run independently. Shared packages must be built first (step 3 above).

| App         | Package              | Port | Command                                   |
| ----------- | -------------------- | ---- | ----------------------------------------- |
| API         | `@restaurant/api`    | 3000 | `pnpm --filter @restaurant/api dev`       |
| Storefront  | `@restaurant/storefront` | 3001 | `pnpm --filter @restaurant/storefront dev` |
| POS / KDS   | `@restaurant/pos`    | 3002 | `pnpm --filter @restaurant/pos dev`       |

The API exposes a global prefix `/api/v1` and a health check at
`GET /api/v1/health` returning `{ "status": "ok" }`.

> **Database URL:** the API reads `DATABASE_URL` (default `file:./dev.db`,
> relative to the process working directory). When started from the repo root,
> point it at the seeded file, e.g.
> `DATABASE_URL=file:./packages/db/dev.db pnpm --filter @restaurant/api dev`.

## Useful scripts

```bash
pnpm lint            # ESLint across the workspace
pnpm typecheck       # tsc --noEmit for every package that defines it
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
  api/          # NestJS API (health, global validation pipe)
  storefront/   # Next.js public ordering site (port 3001)
  pos/          # Next.js POS / KDS / Admin console (port 3002)
packages/
  db/           # Drizzle schema, client, migrations, seed
  ui/           # Shared components (cn util, Button) + Tailwind
  config/       # Shared typed config (API/public URLs)
  contracts/    # Shared types (placeholder for now)
  printer/      # Printing types (placeholder for now)
```

## Conventions

- **Money** is stored as integer minor units; **rates** as integer basis points.
- Every table has `id` (UUID), `created_at`, `updated_at`.
- Tenant-scoped tables carry `restaurant_id`; location-scoped tables also carry
  `location_id`.
- Shared packages build to `dist/` and are consumed as built JS; they are not run
  from source in this Phase 0 setup.

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
