const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const SLUG_KEY = 'restaurantSlug';

export function getRestaurantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SLUG_KEY);
}

export function setRestaurantSlug(slug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SLUG_KEY, slug);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const slug = getRestaurantSlug();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (slug) headers.set('x-restaurant-slug', slug);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  createTenant: (body: unknown) =>
    request<{ id: string; slug: string }>('/admin/tenants', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listLocations: () =>
    request<{ id: string; name: string; address: string | null; active: number }[]>('/admin/locations'),
  createLocation: (body: unknown) =>
    request<{ id: string }>('/admin/locations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getSettings: () =>
    request<{ currency: string; timezone: string; defaultLanguage: string; settings: Record<string, string> }>(
      '/admin/settings'
    ),
  updateBranding: (body: unknown) =>
    request<{ id: string }>('/admin/settings/branding', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  uploadFile: async (file: File) => {
    const slug = getRestaurantSlug();
    const headers = new Headers();
    if (slug) headers.set('x-restaurant-slug', slug);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/admin/upload`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return (await res.json()) as { url: string };
  },
};
