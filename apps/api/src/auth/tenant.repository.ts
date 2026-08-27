import { and, eq } from 'drizzle-orm';
import { Injectable } from '@nestjs/common';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getDb, restaurants, roles, users, locations, userLocations, settings, schema } from '@restaurant/db';

type Db = LibSQLDatabase<typeof schema>;

@Injectable()
export class TenantRepository {
  async findBySlug(slug: string, db: Db = getDb()): Promise<{ id: string } | null> {
    const rows = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(restaurantId: string, db: Db = getDb()) {
    const [row] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);
    return row ?? null;
  }

  async verifyLocation(locationId: string, restaurantId: string, db: Db = getDb()): Promise<boolean> {
    const rows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.restaurantId, restaurantId)))
      .limit(1);
    return rows.length > 0;
  }

  async insertRestaurant(values: typeof restaurants.$inferInsert, db: Db = getDb()) {
    const [row] = await db.insert(restaurants).values(values).returning();
    if (!row) throw new Error('Failed to insert restaurant');
    return row;
  }

  async insertRole(values: typeof roles.$inferInsert, db: Db = getDb()) {
    const [row] = await db.insert(roles).values(values).returning();
    if (!row) throw new Error('Failed to insert role');
    return row;
  }

  async insertUser(values: typeof users.$inferInsert, db: Db = getDb()) {
    const [row] = await db.insert(users).values(values).returning();
    if (!row) throw new Error('Failed to insert user');
    return row;
  }

  async insertLocation(values: typeof locations.$inferInsert, db: Db = getDb()) {
    const [row] = await db.insert(locations).values(values).returning();
    if (!row) throw new Error('Failed to insert location');
    return row;
  }

  async insertUserLocation(values: typeof userLocations.$inferInsert, db: Db = getDb()) {
    const [row] = await db.insert(userLocations).values(values).returning();
    if (!row) throw new Error('Failed to insert user location');
    return row;
  }

  async listActiveLocations(restaurantId: string, db: Db = getDb()) {
    return db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(and(eq(locations.restaurantId, restaurantId), eq(locations.active, 1)));
  }

  async listSettings(restaurantId: string, db: Db = getDb()) {
    return db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(eq(settings.restaurantId, restaurantId));
  }

  async updateRestaurant(restaurantId: string, values: Partial<typeof restaurants.$inferInsert>, db: Db = getDb()) {
    await db.update(restaurants).set(values).where(eq(restaurants.id, restaurantId));
  }

  async upsertSetting(restaurantId: string, key: string, value: string, db: Db = getDb()) {
    await db
      .insert(settings)
      .values({ restaurantId, key, value })
      .onConflictDoUpdate({
        target: [settings.restaurantId, settings.key],
        set: { value },
      });
  }
}
