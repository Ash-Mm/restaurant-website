import { and, eq } from 'drizzle-orm';
import { Injectable } from '@nestjs/common';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getDb, locations, schema } from '@restaurant/db';

type Db = LibSQLDatabase<typeof schema>;

@Injectable()
export class LocationRepository {
  async listByRestaurant(
    restaurantId: string,
    db: Db = getDb()
  ): Promise<typeof locations.$inferSelect[]> {
    return db
      .select()
      .from(locations)
      .where(eq(locations.restaurantId, restaurantId));
  }

  async findById(id: string, db: Db = getDb()): Promise<typeof locations.$inferSelect | null> {
    const [row] = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
    return row ?? null;
  }

  async insert(
    values: typeof locations.$inferInsert,
    db: Db = getDb()
  ): Promise<typeof locations.$inferSelect> {
    const [row] = await db.insert(locations).values(values).returning();
    if (!row) throw new Error('Failed to insert location');
    return row;
  }

  async update(
    id: string,
    values: Partial<typeof locations.$inferInsert>,
    db: Db = getDb()
  ): Promise<void> {
    await db.update(locations).set(values).where(eq(locations.id, id));
  }

  async belongsToRestaurant(id: string, restaurantId: string, db: Db = getDb()): Promise<boolean> {
    const [row] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, id), eq(locations.restaurantId, restaurantId)))
      .limit(1);
    return Boolean(row);
  }
}
