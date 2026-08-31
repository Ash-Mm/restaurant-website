/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { z } from 'zod';

export const categoryNameSchema = z.string().trim().min(2, 'Name too short').max(100, 'Name too long');

export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z.object({
  name: categoryNameSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const reorderCategoriesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type Category = z.infer<typeof categorySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;

export const modifierOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  priceDeltaMinor: z.number().int(),
});

export const modifierGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  minSelect: z.number().int().min(0),
  maxSelect: z.number().int().min(0),
  options: z.array(modifierOptionSchema),
});

export const createModifierGroupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(0).default(1),
  options: z.array(
    z.object({
      name: z.string().trim().min(1).max(100),
      priceDeltaMinor: z.number().int().min(0).default(0),
    }),
  ).optional(),
});

export const createModifierOptionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  priceDeltaMinor: z.number().int().min(0).default(0),
});

export type ModifierGroup = z.infer<typeof modifierGroupSchema>;
export type ModifierOption = z.infer<typeof modifierOptionSchema>;

export const productSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  barcode: z.string().nullable(),
  isAvailable: z.boolean().optional(),
  priceMinor: z.number().int().min(0).optional(),
  modifierGroups: z.array(modifierGroupSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  categoryId: z.string().uuid().optional().nullable(),
  barcode: z.string().trim().max(50).optional().nullable(),
  priceMinor: z.number().int().min(0).optional(),
  isAvailable: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type Product = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Public menu types (returned by GET /public/:slug/menu — extended)
export const publicMenuCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
});

export const publicMenuProductSchema = z.object({
  id: z.string(),
  categoryId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  barcode: z.string().nullable(),
  priceMinor: z.number().int(),
  isAvailable: z.boolean(),
  modifierGroups: z.array(modifierGroupSchema).optional(),
});

export const publicMenuSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullable(),
  brandColor: z.string().nullable(),
  receiptHeader: z.string().nullable(),
  receiptFooter: z.string().nullable(),
  currency: z.string(),
  categories: z.array(publicMenuCategorySchema),
  products: z.array(publicMenuProductSchema),
});

export type PublicMenuCategory = z.infer<typeof publicMenuCategorySchema>;
export type PublicMenuProduct = z.infer<typeof publicMenuProductSchema>;
export type PublicMenu = z.infer<typeof publicMenuSchema>;

export function formatMinor(minor: number, currency = 'EGP'): string {
  const major = (minor / 100).toFixed(2);
  return `${major} ${currency}`;
}

export function calculateModifierDelta(selected: ModifierOption[]): number {
  return selected.reduce((sum, o) => sum + o.priceDeltaMinor, 0);
}

export function validateModifierSelection(
  group: ModifierGroup,
  selectedCount: number,
): string | null {
  if (selectedCount < group.minSelect) return `Select at least ${group.minSelect}`;
  if (group.maxSelect > 0 && selectedCount > group.maxSelect) return `Select at most ${group.maxSelect}`;
  return null;
}
