import { and, eq } from 'drizzle-orm';
import { Injectable } from '@nestjs/common';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getDb, refreshTokens, restaurants, schema, users } from '@restaurant/db';

type Db = LibSQLDatabase<typeof schema>;
export type UserRow = typeof users.$inferSelect;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

export interface NewRefreshToken {
  restaurantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
}

@Injectable()
export class AuthRepository {
  async findRestaurantIdBySlug(slug: string, db: Db = getDb()): Promise<string | null> {
    const [row] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    return row?.id ?? null;
  }

  async findUsersByEmail(email: string, restaurantId?: string, db: Db = getDb()): Promise<UserRow[]> {
    const condition =
      restaurantId === undefined
        ? eq(users.email, email)
        : and(eq(users.email, email), eq(users.restaurantId, restaurantId));
    return db.select().from(users).where(condition);
  }

  async findUserById(restaurantId: string, userId: string, db: Db = getDb()): Promise<UserRow | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.restaurantId, restaurantId)))
      .limit(1);
    return row ?? null;
  }

  async insertRefreshToken(values: NewRefreshToken, db: Db = getDb()): Promise<RefreshTokenRow> {
    const [row] = await db.insert(refreshTokens).values(values).returning();
    if (!row) throw new Error('Failed to insert refresh token');
    return row;
  }

  async findTokenByHash(tokenHash: string, db: Db = getDb()): Promise<RefreshTokenRow | null> {
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }
}
