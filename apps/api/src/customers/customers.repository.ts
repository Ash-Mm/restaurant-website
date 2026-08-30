import { and, eq, isNull } from 'drizzle-orm';
import { Injectable } from '@nestjs/common';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { customers, getDb, restaurants, schema } from '@restaurant/db';

type Db = LibSQLDatabase<typeof schema>;
export type CustomerRow = typeof customers.$inferSelect;

export interface NewGuestCustomer {
  restaurantId: string;
  name?: string;
  email?: string;
  phone?: string;
  trackingTokenHash: string;
  trackingExpiresAt: string;
}

@Injectable()
export class CustomersRepository {
  async findRestaurantIdBySlug(slug: string, db: Db = getDb()): Promise<string | null> {
    const [row] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    return row?.id ?? null;
  }

  async insertGuestCustomer(values: NewGuestCustomer, db: Db = getDb()): Promise<CustomerRow> {
    const [row] = await db
      .insert(customers)
      .values({
        restaurantId: values.restaurantId,
        name: values.name ?? null,
        email: values.email ?? null,
        phone: values.phone ?? null,
        trackingTokenHash: values.trackingTokenHash,
        trackingExpiresAt: values.trackingExpiresAt,
      })
      .returning();
    if (!row) throw new Error('Failed to insert guest customer');
    return row;
  }

  async findByTrackingTokenHash(
    restaurantId: string,
    tokenHash: string,
    db: Db = getDb()
  ): Promise<CustomerRow | null> {
    const [row] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.restaurantId, restaurantId),
          eq(customers.trackingTokenHash, tokenHash),
          isNull(customers.trackingRevokedAt)
        )
      )
      .limit(1);
    return row ?? null;
  }

  async revokeTrackingToken(
    restaurantId: string,
    customerId: string,
    db: Db = getDb()
  ): Promise<void> {
    await db
      .update(customers)
      .set({ trackingRevokedAt: new Date().toISOString() })
      .where(
        and(eq(customers.restaurantId, restaurantId), eq(customers.id, customerId)),
      );
  }
}
