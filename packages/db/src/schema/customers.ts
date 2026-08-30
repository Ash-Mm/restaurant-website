import { foreignKey, index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { baseColumns, tenantColumns } from './columns.js';
import { restaurants } from './restaurants.js';

/**
 * Customers of a restaurant. Used for guest checkout identity: a guest gets
 * an opaque tracking token (returned once) whose SHA-256 hash is stored here,
 * so they can look up their orders later without an account.
 */
export const customers = sqliteTable(
  'customers',
  {
    ...baseColumns(),
    ...tenantColumns(),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    trackingTokenHash: text('tracking_token_hash'),
    trackingExpiresAt: text('tracking_expires_at'),
    trackingRevokedAt: text('tracking_revoked_at'),
  },
  (t) => [
    index('customers_restaurant_id_idx').on(t.restaurantId),
    index('customers_tracking_token_hash_idx').on(t.trackingTokenHash),
    foreignKey({
      columns: [t.restaurantId],
      foreignColumns: [restaurants.id],
      name: 'customers_restaurant_id_fk',
    }).onDelete('cascade'),
  ]
);
