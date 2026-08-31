const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export interface PublicCategory { id: string; name: string; sortOrder: number }
export interface ModifierOption { id: string; modifierGroupId: string; name: string; priceDeltaMinor: number }
export interface ModifierGroup { id: string; productId: string; name: string; minSelect: number; maxSelect: number; options: ModifierOption[] }
export interface PublicProduct {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  barcode: string | null;
  priceMinor: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  modifierGroups?: ModifierGroup[];
}
export interface PublicMenuResponse {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  currency: string;
  timezone: string;
  defaultLanguage: string;
  locations: { id: string; name: string }[];
  categories: PublicCategory[];
  products: PublicProduct[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  // x-restaurant-slug is set via middleware for /r/:slug rewrites, but keep explicit header for direct calls
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  getPublicMenu: (slug: string) => request<PublicMenuResponse>(`/public/${slug}/menu`),
  getPublicProduct: (slug: string, productId: string) =>
    request<PublicProduct>(`/public/${slug}/menu/products/${productId}`),
};

export function formatMinor(minor: number, currency = 'EGP'): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export function calculateModifierDelta(selected: ModifierOption[]): number {
  return selected.reduce((s, o) => s + o.priceDeltaMinor, 0);
}
