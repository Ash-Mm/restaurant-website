'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@restaurant/ui';
import { Input } from '@restaurant/ui';
import { Label } from '@restaurant/ui';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@restaurant/ui';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email({ message: 'Invalid email' })),
  password: z.string().min(1, 'Password required').max(200),
});

type FormValues = z.infer<typeof schema>;

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/')) return '/';
    if (decoded.startsWith('//')) return '/';
    if (decoded.includes('\\')) return '/';
    return decoded;
  } catch {
    return '/';
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const next = safeNext(searchParams.get('next'));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      router.push(next);
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Login failed';
      // Map 401 to friendly message, avoid leaking details
      if (e instanceof ApiError && e.status === 401) {
        setServerError('Invalid email or password');
      } else if (e instanceof ApiError && e.status === 429) {
        setServerError('Too many attempts, please try again later');
      } else {
        // Attempt to parse zod flatten if present
        try {
          const parsed = JSON.parse(msg) as { fieldErrors?: Record<string, string[]> };
          if (parsed.fieldErrors) setServerError(Object.values(parsed.fieldErrors).flat().join(', '));
          else setServerError(msg);
        } catch {
          setServerError(msg);
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Staff login</CardTitle>
          <CardDescription>Sign in with your email and password</CardDescription>
        </CardHeader>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@restaurant.com" {...register('email')} />
              {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
              {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
            </div>
            {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
            {next !== '/' && <p className="text-xs text-zinc-500">After sign in you’ll go to {next}</p>}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-4 text-sm text-zinc-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
