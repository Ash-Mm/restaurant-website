import { and, eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { getDb } from './client';
import { restaurants, locations, users, roles, userLocations } from './schema';

function firstRow<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`Expected at least one row for ${label}`);
  }
  return row;
}

async function main() {
  const db = getDb();

  const slug = process.env.SEED_RESTAURANT_SLUG ?? 'dev-restaurant';
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@dev.restaurant';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'dev-only-change-me';

  let restaurantRows = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.slug, slug))
    .limit(1);
  if (restaurantRows.length === 0) {
    restaurantRows = await db
      .insert(restaurants)
      .values({ name: 'Dev Restaurant', slug, currency: 'EGP', timezone: 'UTC', defaultLanguage: 'en' })
      .returning();
  }
  const restaurant = firstRow(restaurantRows, 'restaurant');
  const restaurantId = restaurant.id;

  let locationRows = await db
    .select()
    .from(locations)
    .where(and(eq(locations.restaurantId, restaurantId), eq(locations.name, 'Main Branch')))
    .limit(1);
  if (locationRows.length === 0) {
    locationRows = await db
      .insert(locations)
      .values({ restaurantId, name: 'Main Branch', active: 1 })
      .returning();
  }
  const location = firstRow(locationRows, 'location');

  let roleRows = await db
    .select()
    .from(roles)
    .where(and(eq(roles.restaurantId, restaurantId), eq(roles.name, 'owner')))
    .limit(1);
  if (roleRows.length === 0) {
    roleRows = await db
      .insert(roles)
      .values({ restaurantId, name: 'owner', permissions: JSON.stringify(['*']) })
      .returning();
  }
  const role = firstRow(roleRows, 'role');

  let userRows = await db
    .select()
    .from(users)
    .where(and(eq(users.restaurantId, restaurantId), eq(users.email, email)))
    .limit(1);
  if (userRows.length === 0) {
    const passwordHash = await hash(password);
    userRows = await db
      .insert(users)
      .values({ restaurantId, email, passwordHash, fullName: 'Dev Admin', role: 'owner' })
      .returning();
  }
  const user = firstRow(userRows, 'user');

  const existingLink = await db
    .select()
    .from(userLocations)
    .where(and(eq(userLocations.userId, user.id), eq(userLocations.locationId, location.id)))
    .limit(1);
  if (existingLink.length === 0) {
    await db
      .insert(userLocations)
      .values({ restaurantId, userId: user.id, locationId: location.id });
  }

  console.log('Seed complete', {
    restaurantId,
    locationId: location.id,
    userId: user.id,
    roleId: role.id,
  });
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
