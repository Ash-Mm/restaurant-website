import { z } from 'zod';

export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric and may contain single hyphens'
  );

export type Slug = z.infer<typeof slugSchema>;

export function isSlugSafe(value: unknown): value is string {
  return slugSchema.safeParse(value).success;
}

export function assertSlugSafe(value: unknown): asserts value is string {
  slugSchema.parse(value);
}
