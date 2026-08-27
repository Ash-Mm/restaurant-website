import { z } from 'zod';

export const brandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'brandColor must be a hex color like #1A2B3C')
    .nullable()
    .optional(),
  receiptHeader: z.string().max(500).nullable().optional(),
  receiptFooter: z.string().max(500).nullable().optional(),
});

export type BrandingDto = z.infer<typeof brandingSchema>;
