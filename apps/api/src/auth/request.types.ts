export interface AppRequest {
  headers: Record<string, string | string[] | undefined>;
  restaurantId?: string;
  locationId?: string;
}
