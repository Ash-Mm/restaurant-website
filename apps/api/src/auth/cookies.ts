import type { Request, Response } from 'express';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH, REFRESH_TTL_MS } from './auth.constants.js';

function cookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(res: Response, rawToken: string): void {
  res.cookie(REFRESH_COOKIE, rawToken, { ...cookieBaseOptions(), maxAge: REFRESH_TTL_MS });
}

export function clearRefreshCookie(res: Response): void {
  res.cookie(REFRESH_COOKIE, '', { ...cookieBaseOptions(), maxAge: 0 });
}

export function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (typeof header !== 'string' || header.length === 0) {
    return null;
  }
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === REFRESH_COOKIE) {
      return part.slice(idx + 1).trim() || null;
    }
  }
  return null;
}
