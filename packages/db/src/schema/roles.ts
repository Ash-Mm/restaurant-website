import { foreignKey, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { baseColumns, tenantColumns } from './columns';
import { restaurants } from './restaurants';

export const roles = sqliteTable(
  'roles',
  {
    ...baseColumns(),
    ...tenantColumns(),
    name: text('name').notNull(),
    permissions: text('permissions'),
  },
  (t) => [
    index('roles_restaurant_id_idx').on(t.restaurantId),
    uniqueIndex('roles_restaurant_name_unique').on(t.restaurantId, t.name),
    foreignKey({
      columns: [t.restaurantId],
      foreignColumns: [restaurants.id],
      name: 'roles_restaurant_id_fk',
    }).onDelete('cascade'),
  ]
);
