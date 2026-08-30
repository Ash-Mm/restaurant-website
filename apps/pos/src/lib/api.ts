const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const SLUG_KEY = 'restaurantSlug';

// Access token in memory only (AGENTS: never store access tokens in
// localStorage/cookies readable from JS). The refresh token lives in an
// httpOnly cookie scoped to /api/v1/auth/staff, managed by the browser.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}
export function setTokens(tokens: { accessToken: string; refreshToken?: string }): void {
  accessToken = tokens.accessToken;
}
export function clearTokens(): void {
  accessToken = null;
}
export function getRefreshToken(): string | null {
  // Refresh tokens are never exposed to JS; kept for API compatibility.
  return null;
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

/** Auth endpoints never trigger the refresh-on-401 retry (no loops). */
const AUTH_PATHS = ['/auth/staff/login', '/auth/staff/refresh', '/auth/staff/logout'];

async function rawRequest<T>(path: string, init: RequestInit): Promise<T> {
  const slug = getRestaurantSlug();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (slug) headers.set('x-restaurant-slug', slug);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  // Location isolation: AGENTS requires X-Location-Id when staff scoped
  const loc = typeof window !== 'undefined' ? window.localStorage.getItem('locationId') : null;
  if (loc) headers.set('X-Location-Id', loc);

  // credentials: 'include' so the httpOnly refresh cookie (API origin) is sent
  // to /auth/staff/refresh and /auth/staff/logout.
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

let refreshInFlight: Promise<void> | null = null;

/**
 * Refreshes the access token exactly once via the httpOnly refresh cookie.
 * The backend ignores request bodies on /auth/staff/refresh — the cookie does
 * the work (rotation included). Concurrent 401s share one in-flight refresh.
 */
function refreshAccessToken(): Promise<void> {
  refreshInFlight ??= (async () => {
    const res = await fetch(`${API_BASE}/auth/staff/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text || res.statusText);
    }
    const data = (await res.json()) as { accessToken: string };
    setTokens({ accessToken: data.accessToken });
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (err) {
    const isAuthPath = AUTH_PATHS.some((p) => path.startsWith(p));
    if (err instanceof ApiError && err.status === 401 && !isAuthPath) {
      // Access token likely expired (15 min TTL): refresh once and retry once.
      try {
        await refreshAccessToken();
      } catch {
        throw err;
      }
      return rawRequest<T>(path, init);
    }
    throw err;
  }
}

export const api = {
  // Auth — AGENTS staff login with email/password; the refresh token arrives
  // as an httpOnly cookie (never in the response body).
  login: (body: { email: string; password: string }) =>
    request<{ accessToken: string; user: { id: string; email: string; fullName: string; role: string } }>(
      '/auth/staff/login',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),
  refresh: () =>
    request<{ accessToken: string }>('/auth/staff/refresh', { method: 'POST' }),
  logout: () => request<undefined>('/auth/staff/logout', { method: 'POST' }),
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
