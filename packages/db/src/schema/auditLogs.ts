import { foreignKey, index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { baseColumns, tenantColumns } from './columns';
import { restaurants } from './restaurants';
import { users } from './users';

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    ...baseColumns(),
    ...tenantColumns(),
    userId: text('user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    metadata: text('metadata'),
  },
  (t) => [
    index('audit_logs_restaurant_id_idx').on(t.restaurantId),
    foreignKey({
      columns: [t.userId],
      foreignColumns: [users.id],
      name: 'audit_logs_user_id_fk',
    }).onDelete('set null'),
    foreignKey({
      columns: [t.restaurantId],
      foreignColumns: [restaurants.id],
      name: 'audit_logs_restaurant_id_fk',
    }).onDelete('cascade'),
  ]
);
