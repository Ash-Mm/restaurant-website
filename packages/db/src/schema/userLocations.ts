import { foreignKey, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { baseColumns, locationColumns } from './columns';
import { restaurants } from './restaurants';
import { locations } from './locations';
import { users } from './users';

export const userLocations = sqliteTable(
  'user_locations',
  {
    ...baseColumns(),
    ...locationColumns(),
    userId: text('user_id').notNull(),
  },
  (t) => [
    index('user_locations_restaurant_id_idx').on(t.restaurantId),
    index('user_locations_location_id_idx').on(t.locationId),
    uniqueIndex('user_locations_user_location_unique').on(t.userId, t.locationId),
    foreignKey({
      columns: [t.userId],
      foreignColumns: [users.id],
      name: 'user_locations_user_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.locationId],
      foreignColumns: [locations.id],
      name: 'user_locations_location_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.restaurantId],
      foreignColumns: [restaurants.id],
      name: 'user_locations_restaurant_id_fk',
    }).onDelete('cascade'),
  ]
);
