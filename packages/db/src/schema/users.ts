import { foreignKey, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { baseColumns, tenantColumns } from './columns';
import { restaurants } from './restaurants';

export const users = sqliteTable(
  'users',
  {
    ...baseColumns(),
    ...tenantColumns(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    role: text('role').notNull().default('customer'),
  },
  (t) => [
    index('users_restaurant_id_idx').on(t.restaurantId),
    uniqueIndex('users_restaurant_email_unique').on(t.restaurantId, t.email),
    foreignKey({
      columns: [t.restaurantId],
      foreignColumns: [restaurants.id],
      name: 'users_restaurant_id_fk',
    }).onDelete('cascade'),
  ]
);
