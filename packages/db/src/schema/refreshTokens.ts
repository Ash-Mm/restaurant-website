import { foreignKey, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { baseColumns, tenantColumns } from './columns.js';
import { restaurants } from './restaurants.js';
import { users } from './users.js';

/**
 * Refresh token sessions. Only the SHA-256 hash of the token is stored
 * (AGENTS.md: refresh tokens never stored in plaintext). Rotation records the
 * successor in `replaced_by_token_id`; replaying a revoked token revokes all
 * tokens for the user (token-theft detection).
 */
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
