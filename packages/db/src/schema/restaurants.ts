import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { baseColumns } from './columns.js';

export const restaurants = sqliteTable(
  'restaurants',
  {
    ...baseColumns(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logoUrl: text('logo_url'),
    brandColor: text('brand_color'),
    defaultLanguage: text('default_language').notNull().default('en'),
    currency: text('currency').notNull().default('EGP'),
    timezone: text('timezone').notNull().default('UTC'),
  },
  (t) => [uniqueIndex('restaurants_slug_unique').on(t.slug)]
);
