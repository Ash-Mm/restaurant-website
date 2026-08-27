import { and, eq } from 'drizzle-orm';
import { Injectable } from '@nestjs/common';
import { getDb, restaurants, locations } from '@restaurant/db';

@Injectable()
export class TenantRepository {
  async findBySlug(slug: string): Promise<{ id: string } | null> {
    const rows = await getDb()
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  }

  async verifyLocation(locationId: string, restaurantId: string): Promise<boolean> {
    const rows = await getDb()
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.restaurantId, restaurantId)))
      .limit(1);
    return rows.length > 0;
  }
}
