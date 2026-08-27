import { z } from 'zod';
import { slugSchema } from '@restaurant/contracts';

export const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema,
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  currency: z.string().length(3).optional().default('EGP'),
  timezone: z.string().min(1).max(64).optional().default('UTC'),
  defaultLanguage: z.string().min(2).max(8).optional().default('en'),
});

export type CreateTenantDto = z.infer<typeof createTenantSchema>;
