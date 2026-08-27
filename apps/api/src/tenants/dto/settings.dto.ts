import { z } from 'zod';

export const updateSettingsSchema = z.object({
  currency: z.string().length(3).optional(),
  timezone: z.string().min(1).max(64).optional(),
  defaultLanguage: z.string().min(2).max(8).optional(),
  settings: z.record(z.string()).optional(),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
