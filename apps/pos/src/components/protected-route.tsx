'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '../lib/auth';

function ProtectedRouteInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const full = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      router.replace(`/login?next=${encodeURIComponent(full)}`);
    }
  }, [isAuthenticated, isLoading, pathname, searchParams, router]);

  if (isLoading) return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading…</div>}>
      <ProtectedRouteInner>{children}</ProtectedRouteInner>
    </Suspense>
  );
}
