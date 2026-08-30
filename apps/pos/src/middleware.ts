import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/onboarding'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAsset = pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico';

  if (isPublic || isAsset) return NextResponse.next();

  const token = request.cookies.get('pos_at')?.value;
  if (!token) {
    const next = encodeURIComponent(pathname + search);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${next}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
