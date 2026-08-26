import { foreignKey, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { baseColumns, tenantColumns } from './columns.js';
import { restaurants } from './restaurants.js';

export const locations = sqliteTable(
  'locations',
  {
    ...baseColumns(),
    ...tenantColumns(),
    name: text('name').notNull(),
    address: text('address'),
    active: integer('active').notNull().default(1),
    taxRegistrationNumber: text('tax_registration_number'),
  },
  (t) => [
    index('locations_restaurant_id_idx').on(t.restaurantId),
    foreignKey({
      columns: [t.restaurantId],
      foreignColumns: [restaurants.id],
      name: 'locations_restaurant_id_fk',
    }).onDelete('cascade'),
  ]
);
