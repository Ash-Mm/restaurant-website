import { foreignKey, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { baseColumns, tenantColumns } from './columns';
import { restaurants } from './restaurants';

export const settings = sqliteTable(
  'settings',
  {
    ...baseColumns(),
    ...tenantColumns(),
    key: text('key').notNull(),
    value: text('value'),
  },
  (t) => [
    index('settings_restaurant_id_idx').on(t.restaurantId),
    uniqueIndex('settings_restaurant_key_unique').on(t.restaurantId, t.key),
    foreignKey({
      columns: [t.restaurantId],
      foreignColumns: [restaurants.id],
      name: 'settings_restaurant_id_fk',
    }).onDelete('cascade'),
  ]
);
