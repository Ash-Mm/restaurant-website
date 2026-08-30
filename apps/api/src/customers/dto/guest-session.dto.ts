import { z } from 'zod';

export const guestSessionSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(200).optional(),
    phone: z.string().trim().min(3).max(40).optional(),
  })
  .strict();

export type GuestSessionDto = z.infer<typeof guestSessionSchema>;

export const resolveGuestSchema = z.object({
  restaurantSlug: z.string().min(1).max(100),
  trackingToken: z.string().min(1).max(200),
});

export type ResolveGuestDto = z.infer<typeof resolveGuestSchema>;
