import type { users } from '@restaurant/db';

export interface AppRequest {
  headers: Record<string, string | string[] | undefined>;
  restaurantId?: string;
  locationId?: string;
  userId?: string;
  user?: typeof users.$inferSelect;
}
