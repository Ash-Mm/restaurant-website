import { eq } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getDb, restaurants, roles, users, locations, userLocations, settings, schema } from '@restaurant/db';

type Db = LibSQLDatabase<typeof schema>;

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  defaultLanguage: string;
}

export class TenantRepository {
  async findBySlug(slug: string, db: Db = getDb()): Promise<TenantRow | null> {
    const rows = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        currency: restaurants.currency,
        timezone: restaurants.timezone,
        defaultLanguage: restaurants.defaultLanguage,
      })
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(id: string, db: Db = getDb()): Promise<TenantRow | null> {
    const rows = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        currency: restaurants.currency,
        timezone: restaurants.timezone,
        defaultLanguage: restaurants.defaultLanguage,
      })
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async insertRestaurant(
    values: typeof restaurants.$inferInsert,
    db: Db = getDb()
  ): Promise<typeof restaurants.$inferSelect> {
    const [row] = await db.insert(restaurants).values(values).returning();
    if (!row) throw new Error('Failed to insert restaurant');
    return row;
  }

  async updateRestaurant(
    id: string,
    values: Partial<typeof restaurants.$inferInsert>,
    db: Db = getDb()
  ): Promise<void> {
    await db.update(restaurants).set(values).where(eq(restaurants.id, id));
  }

  async insertRole(
    values: typeof roles.$inferInsert,
    db: Db = getDb()
  ): Promise<typeof roles.$inferSelect> {
    const [row] = await db.insert(roles).values(values).returning();
    if (!row) throw new Error('Failed to insert role');
    return row;
  }

  async insertUser(
    values: typeof users.$inferInsert,
    db: Db = getDb()
  ): Promise<typeof users.$inferSelect> {
    const [row] = await db.insert(users).values(values).returning();
    if (!row) throw new Error('Failed to insert user');
    return row;
  }

  async insertLocation(
    values: typeof locations.$inferInsert,
    db: Db = getDb()
  ): Promise<typeof locations.$inferSelect> {
    const [row] = await db.insert(locations).values(values).returning();
    if (!row) throw new Error('Failed to insert location');
    return row;
  }

  async insertUserLocation(
    values: typeof userLocations.$inferInsert,
    db: Db = getDb()
  ): Promise<void> {
    await db.insert(userLocations).values(values);
  }

  async listSettings(restaurantId: string, db: Db = getDb()): Promise<{ key: string; value: string | null }[]> {
    return db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(eq(settings.restaurantId, restaurantId));
  }

  async upsertSetting(restaurantId: string, key: string, value: string, db: Db = getDb()): Promise<void> {
    await db
      .insert(settings)
      .values({ restaurantId, key, value })
      .onConflictDoUpdate({ target: [settings.restaurantId, settings.key], set: { value } });
  }
}
