'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@restaurant/ui';
import { api, ApiError, getRestaurantSlug } from '../../lib/api';

const schema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #1A2B3C')
    .nullable()
    .optional(),
  receiptHeader: z.string().max(500).nullable().optional(),
  receiptFooter: z.string().max(500).nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

const inputCls = 'w-full rounded border border-gray-300 p-2 text-sm';

export default function BrandingPage() {
  const slug = getRestaurantSlug();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const { isLoading, data: profile } = useQuery({
    queryKey: ['branding'],
    enabled: Boolean(slug),
    queryFn: () => {
      if (!slug) return Promise.resolve(null);
      return api.getPublicProfile(slug);
    },
  });

  useEffect(() => {
    if (!profile) return;
    setLogoUrl(profile.logoUrl);
    reset({
      logoUrl: profile.logoUrl ?? undefined,
      brandColor: profile.brandColor ?? undefined,
      receiptHeader: profile.receiptHeader ?? undefined,
      receiptFooter: profile.receiptFooter ?? undefined,
    });
  }, [profile, reset]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploadFile(file);
      setLogoUrl(url);
      setValue('logoUrl', url);
      setSaved(false);
    } catch {
      // ignore upload errors for now
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.updateBranding({ ...values, logoUrl });
      setSaved(true);
    } catch (err) {
      // surface via alert for simplicity
      alert(err instanceof ApiError ? `Failed (${String(err.status)})` : 'Failed to save branding');
    }
  });

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Branding</h1>

      {isLoading && <p className="mb-4 text-sm text-gray-500">Loading…</p>}

      <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Logo</label>
          <input type="file" accept="image/*" onChange={(e) => { void onFile(e); }} />
          {uploading && <p className="text-xs text-gray-500">Uploading…</p>}
          {logoUrl && <p className="text-xs text-green-600">Uploaded: {logoUrl}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Brand color</label>
          <div className="flex gap-2">
            <input
              type="color"
              className="h-9 w-12 rounded border"
              value={watch('brandColor') ?? '#000000'}
              onChange={(e) => {
                setValue('brandColor', e.target.value, { shouldValidate: true });
              }}
            />
            <input className={inputCls} placeholder="#1A2B3C" {...register('brandColor')} />
          </div>
          {errors.brandColor && <p className="text-xs text-red-600">{errors.brandColor.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Receipt header</label>
          <textarea className={inputCls} rows={2} {...register('receiptHeader')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Receipt footer</label>
          <textarea className={inputCls} rows={2} {...register('receiptFooter')} />
        </div>
        <Button type="submit" className="w-full">
          Save branding
        </Button>
        {saved && <p className="text-sm text-green-600">Saved.</p>}
      </form>
    </main>
  );
}
