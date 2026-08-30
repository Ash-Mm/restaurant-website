import { z } from 'zod';

export const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  restaurantSlug: z.string().min(1).max(100).optional(),
});

export type StaffLoginDto = z.infer<typeof staffLoginSchema>;
