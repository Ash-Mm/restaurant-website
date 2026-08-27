import { NextResponse, type NextRequest } from 'next/server';

/**
 * Resolves the public tenant from the `/r/:slug` path segment and forwards the
 * resolved slug to the application via the `x-restaurant-slug` request header.
 * The path prefix is stripped by rewriting to the storefront root so the same
 * pages can serve every restaurant.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const match = /^\/r\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match) {
    return NextResponse.next();
  }
  const slug = match[1] ?? '';
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-restaurant-slug', slug);

  const url = request.nextUrl.clone();
  url.pathname = pathname.replace(/^\/r\/[^/]+/, '') || '/';
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/r/:slug/:path*'],
};
