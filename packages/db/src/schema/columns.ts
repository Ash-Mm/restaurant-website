import { randomUUID } from 'node:crypto';
import { integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Columns present on every table: UUID primary key plus created/updated
 * timestamps stored as ISO 8601 UTC strings (AGENTS.md: ISO 8601 UTC).
 */
export function baseColumns() {
  return {
    id: text('id').primaryKey().$defaultFn(() => randomUUID()),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  };
}

/**
 * Tenant scoping. Every tenant-scoped table references `restaurant_id`
 * (AGENTS.md: never add tenant-scoped data without `restaurant_id`).
 * Indexes are added at the table level (see Order 10) to keep this helper
 * free of table-specific config.
 */
export function tenantColumns() {
  return {
    restaurantId: text('restaurant_id').notNull(),
  };
}

/**
 * Location scoping. Every location-scoped table references both
 * `restaurant_id` and `location_id` (AGENTS.md).
 */
export function locationColumns() {
  return {
    ...tenantColumns(),
    locationId: text('location_id').notNull(),
  };
}

/**
 * Money stored as integer minor units (AGENTS.md: never store money as float).
 */
export function money(name: string) {
  return integer(name).notNull().default(0);
}

/**
 * Tax/service rates stored as integer basis points (AGENTS.md: 1400 = 14.00%).
 */
export function basisPoints(name: string) {
  return integer(name).notNull().default(0);
}
