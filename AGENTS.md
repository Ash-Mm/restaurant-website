# AGENTS.md

This file tells AI agents exactly how to work on this project.

## 1. What the project is

A multi-tenant restaurant ordering and operations platform.

One restaurant owner/tenant can have:

- One or more locations/branches.
- Public menu and online ordering.
- Online payment.
- POS/cashier.
- Kitchen display system.
- Receipt printing.
- Inventory with barcode scanning.
- Purchase orders and stock counts.
- Configurable taxes and service charges.
- Reports.

The product is a template that can be sold or operated for different restaurants.

## 2. What you must build

### V1 scope

Build these modules in this order:

1. Tenant management.
2. Location management.
3. Auth and RBAC.
4. Menu and modifiers.
5. Storefront and online ordering.
6. Payment integration.
7. POS and shifts.
8. Kitchen display.
9. Receipts and printing.
10. Inventory and recipes.
11. Purchase orders and stock counts.
12. Reports.

### Not in V1

Do not build unless explicitly asked:

- Delivery or driver dispatch.
- Loyalty points.
- Reservations.
- Waitlist.
- Third-party marketplaces.
- Offline POS sync.
- Multi-vendor marketplace.

## 3. What to use

### Mandatory

| Concern | Technology |
|---|---|
| Language | TypeScript, strict mode only |
| Backend | NestJS |
| Frontend | Next.js + React |
| Workspace | pnpm workspaces |
| UI | Tailwind CSS + shadcn/ui |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod |
| Validation | Zod |
| ORM | Drizzle ORM |
| Local DB | SQLite |
| Production DB | PostgreSQL |
| Auth | JWT access + refresh, Argon2id |
| Payments | PayMob hosted iframe |
| Runtime | Node.js 22 LTS |

### Packages you may add

- PDF generation for receipts.
- ESC/POS network printing library.
- React Hook Form.
- TanStack Query.
- date-fns.
- slug generation.

### Do not add without approval

- Redux.
- GraphQL.
- Prisma.
- A second UI framework.
- Heavy state management libraries.
- MongoDB or other NoSQL databases.
- Kafka or microservice infrastructure.
- Unmaintained payment libraries.

## 4. What not to do

### Data and money

- Never store money as float.
- Never calculate prices on the client.
- Never trust frontend totals.
- Never trust frontend stock values.
- Use integer minor units for all money.
- Use ISO 8601 UTC for timestamps.

### Database

- Never create a table without `id`, `created_at`, `updated_at`.
- Never add tenant-scoped data without `restaurant_id`.
- Never add location-scoped data without `location_id`.
- Never modify an applied migration.
- Never use raw SQL outside the repository layer.
- Keep all SQLite and PostgreSQL compatible.

### Auth and security

- Never store plaintext passwords.
- Never store refresh tokens in plaintext.
- Never store access tokens in localStorage.
- Never trust PayMob callbacks or redirects.
- Always verify PayMob webhooks.
- Always verify user belongs to the location they request.
- Never log passwords, tokens, full card numbers, or HMAC secrets.

### Payments

- Never mark an order paid on client callback only.
- Never skip webhook idempotency.
- Never call the PayMob webhook from the frontend.

### Architecture

- Do not create microservices in V1.
- Do not optimize prematurely.
- Keep one API, one database, clean modules.
- Do not duplicate business logic in frontend and backend.

## 5. Steps to follow for every feature

Follow this process in order.

### Step 1: Understand

- Read the relevant part of DESIGN.md.
- Ask for clarification if the requirement is unclear.
- State the expected behavior before coding.

### Step 2: Data

- Design or update the database schema.
- Create a Drizzle migration.
- Run migration locally on SQLite.
- Update seed data if needed.

### Step 3: Backend

- Create or update the NestJS module.
- Define DTOs with Zod.
- Implement service logic.
- Implement repository.
- Add permission guard and tenant/location guard.
- Add audit logs for privileged actions.
- Don't mark as done before validation.

### Step 4: API documentation

- Update Swagger decorators.
- Ensure the endpoint is documented.

### Step 5: Frontend

- Build or update the UI.
- Use existing shared components.
- Use TanStack Query.
- Use React Hook Form.
- Handle loading and error states.

### Step 6: Tests

- Add unit tests for business logic.
- Add integration tests for the endpoint.
- Test all failure cases.
- Test tenant isolation.
- Test location isolation.
- Test money calculations.

### Step 7: Verify

- Run `pnpm lint`.
- Run `pnpm typecheck`.
- Run `pnpm test`.
- Run the app locally with SQLite.

### Step 8: Review

- Ensure no secrets are committed.
- Ensure migrations and seed data are included.
- Ensure the PR is small and focused.

## 6. How to structure code

```txt
apps/
  storefront/
  pos/
  api/
packages/
  db/
  ui/
  config/
  contracts/
  printer/
```

### Backend module structure

Every NestJS module must contain:

```txt
module.ts
controller.ts
service.ts
repository.ts
dto/
schema/
```

### Rules for controllers

Controllers only:

- Validate input.
- Resolve tenant and location.
- Call a service.
- Return a response.

Never put business logic in controllers.

### Rules for services

Services must:

- Contain business rules.
- Use transactions when needed.
- Throw typed domain errors.

### Rules for repositories

Repositories must:

- Be the only place with database queries.
- Use Drizzle.
- Filter by the active tenant and location.

## 7. Tenant isolation rules

- Every tenant-scoped table must have `restaurant_id`.
- Every tenant query must filter by `restaurant_id`.
- Never expose another tenant's data.
- Staff can only access their own restaurant.
- Staff with location access can only see assigned locations.
- Public storefront resolves tenant from host or slug.
- Guest checkout must attach the resolved restaurant id.
- A guest can never override the restaurant id.

## 8. Location isolation rules

- Every location-scoped table must have `location_id`.
- Staff requests must include `X-Location-Id`.
- Server must verify:
  - location belongs to the user's restaurant.
  - user has permission on that location.
- Admin or owner may access all locations in the restaurant.

## 9. Auth rules

- Staff login with email and password.
- Hash passwords with Argon2id.
- Access token TTL 15 minutes.
- Refresh token TTL 7 days.
- Refresh token stored hashed.
- Customer access is:
  - guest with tracking token, or
  - email OTP account later.
- Permissions are checked through a guard.
- Role names must not be hard-coded in business logic.

## 10. Money rules

- Currency is configured per restaurant.
- Default currency in seed is EGP.
- Store money as integer minor units.
- Round deterministically, half away from zero.
- Server recalculates all totals.
- Store price snapshot on each order line.

## 11. Tax rules

- Tax rates are configurable per restaurant.
- Tax may be inclusive or exclusive.
- Tax types include:

```txt
vat
service
other
```

- Store tax rate in basis points:

```txt
14.00% = 1400
```

- Store immutable tax lines on the order.
- A restaurant may have multiple locations with different tax rules if needed.

## 12. Payment rules

- PayMob hosted iframe is the V1 online provider.
- Payment flow:

```txt
create internal order
PayMob auth request
PayMob order registration
PayMob payment key request
render hosted iframe
customer pays
PayMob webhook
verify HMAC
mark paid
```

- Cash on pickup is allowed.
- POS supports cash and card terminal recording.
- Never store full card data.

## 13. Receipt and printing rules

- Support ESC/POS thermal printers.
- Support 80 mm and 58 mm.
- Generate PDF receipt as fallback.
- Receipt content is customizable per tenant:
  - name.
  - logo.
  - branch.
  - address.
  - tax registration number.
  - header and footer.
- Print jobs must be stored as a queue with retry.

## 14. Kitchen display rules

- Stations are configurable per tenant.
- Default stations:

```txt
hot
cold
drinks
all
```

- Item-level status:

```txt
awaiting
accepted
preparing
ready
```

- KDS polls or uses SSE. Do not require page reload.

## 15. Inventory rules

- Inventory is location-scoped.
- Items may have barcodes.
- Stock movement types:

```txt
purchase_receipt
sale_consumption
manual_adjustment_positive
manual_adjustment_negative
waste
transfer_in
transfer_out
return_restock
```

- Deduction trigger is configurable:

```txt
on_place
on_paid
on_preparing
```

- Cancellation restocks deducted ingredients.

## 16. Testing rules

- Always add tests.
- Unit test money and tax.
- Integration test API.
- Test PayMob webhook idempotency.
- Test tenant isolation.
- Test location isolation.
- Test inventory deductions.

## 17. Git rules

- Conventional commits:

```txt
feat: add tax calculation
fix: paymob webhook idempotency
refactor: inventory deduction
```

- Branch naming:

```txt
feat/tax-engine
fix/paymob-webhook
```

- Do not push to main.
- Open a pull request.
- CI must pass.

## 18. Environment variables

```env
DATABASE_URL=file:./dev.db
JWT_SECRET=dev-only-change-me
JWT_REFRESH_SECRET=dev-only-change-me
CORS_ORIGIN=http://localhost:3000

PAYMOB_API_KEY=...
PAYMOB_INTEGRATION_ID=...
PAYMOB_HMAC_SECRET=...
PAYMOB_IFRAME_ID=...
PAYMOB_API_URL=https://accept.paymob.com/api

NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_PUBLIC_SITE_URL=http://localhost:3001
```

## 19. Environment rules

Use this order:

```txt
development -> sqlite
test -> sqlite
production -> postgres
```

## 20. What "done" means

A task is done only when:

- The feature works locally.
- It has tests.
- Tests pass.
- Lint and typecheck pass.
- API docs are updated.
- Migrations are created.
- Audit logs added for privileged actions.
- Tenant and location isolation tested.
- Money and tax calculations are correct.