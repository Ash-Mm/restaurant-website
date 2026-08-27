'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@restaurant/ui';
import { api, ApiError, setRestaurantSlug } from '../../lib/api';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/, 'Use a URL-safe slug'),
  currency: z.string().length(3).default('EGP'),
  timezone: z.string().min(1).default('UTC'),
  defaultLanguage: z.string().min(2).default('en'),
  fullName: z.string().min(2, 'Owner name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

const inputCls = 'w-full rounded border border-gray-300 p-2 text-sm';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { currency: 'EGP', timezone: 'UTC', defaultLanguage: 'en' } });

  const next = async () => {
    const ok = await trigger(['name', 'slug', 'currency', 'timezone', 'defaultLanguage']);
    if (ok) setStep(1);
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const created = await api.createTenant(values);
      setRestaurantSlug(created.slug);
      router.push('/locations');
    } catch (err) {
      setServerError(err instanceof ApiError ? `Failed to create restaurant (${String(err.status)})` : 'Failed to create restaurant');
    }
  });

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-xl font-semibold">Create your restaurant</h1>
      <p className="mb-4 text-sm text-gray-500">Step {step + 1} of 2</p>

      <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4">
        {step === 0 && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Restaurant name</label>
              <input className={inputCls} {...register('name')} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Slug</label>
              <input className={inputCls} {...register('slug')} placeholder="my-restaurant" />
              {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Currency</label>
                <input className={inputCls} {...register('currency')} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Timezone</label>
                <input className={inputCls} {...register('timezone')} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Language</label>
                <input className={inputCls} {...register('defaultLanguage')} />
              </div>
            </div>
            <Button type="button" onClick={() => { void next(); }} className="w-full">
              Continue
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Owner full name</label>
              <input className={inputCls} {...register('fullName')} />
              {errors.fullName && <p className="text-xs text-red-600">{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Owner email</label>
              <input className={inputCls} type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input className={inputCls} type="password" {...register('password')} />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>
            {serverError && <p className="text-sm text-red-600">{serverError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setStep(0); }} className="w-full">
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Creating…' : 'Create restaurant'}
              </Button>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
