import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  active: z.boolean().optional().default(true),
  taxRegistrationNumber: z.string().max(100).optional(),
});

export type CreateLocationDto = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  active: z.boolean().optional(),
  taxRegistrationNumber: z.string().max(100).optional(),
});

export type UpdateLocationDto = z.infer<typeof updateLocationSchema>;
