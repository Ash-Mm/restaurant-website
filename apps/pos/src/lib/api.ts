const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const SLUG_KEY = 'restaurantSlug';

// Access token in memory (AGENTS: Never store access tokens in localStorage, DESIGN: access in memory)
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}
export function setTokens(tokens: { accessToken: string; refreshToken: string }): void {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  // Also set a non-httpOnly cookie for Next.js middleware redirect (memory is source of truth)
  // Never store tokens in localStorage per AGENTS
  if (typeof document !== 'undefined') {
    document.cookie = `pos_at=${tokens.accessToken}; path=/; max-age=900; SameSite=Lax`;
  }
}
export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  if (typeof document !== 'undefined') {
    document.cookie = `pos_at=; path=/; max-age=0`;
  }
}
export function getRefreshToken(): string | null {
  return refreshToken;
}

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
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  // Location isolation: AGENTS requires X-Location-Id when staff scoped
  const loc = typeof window !== 'undefined' ? window.localStorage.getItem('locationId') : null;
  if (loc) headers.set('X-Location-Id', loc);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // Auth — AGENTS staff login with email/password, returns access+refresh
  login: (body: { email: string; password: string }) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  refresh: (body: { refreshToken: string }) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/staff/refresh', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: (body?: { refreshToken?: string }) =>
    request<{ revoked: number }>('/auth/staff/logout', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  me: () =>
    request<{
      id: string;
      email: string;
      fullName: string;
      role: string;
      restaurantId: string;
      permissions: string[];
      locations: { id: string; name: string }[];
    }>('/auth/me'),
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
  getPublicProfile: (slug: string) =>
    request<{
      logoUrl: string | null;
      brandColor: string | null;
      receiptHeader: string | null;
      receiptFooter: string | null;
    }>(`/public/${slug}/menu`),
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
