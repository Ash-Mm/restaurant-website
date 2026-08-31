'use client';
/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-conversion */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type PublicProduct, type ModifierGroup, type ModifierOption } from '../../../lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';

function getSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const match = /^\/r\/([^/]+)/.exec(window.location.pathname);
  if (match) return match[1] ?? null;
  const params = new URLSearchParams(window.location.search);
  return params.get('slug');
}

function formatMoney(minor: number, currency: string) {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id;
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    setSlug(getSlugFromLocation());
  }, []);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['publicMenu', slug],
    queryFn: () => {
      if (!slug) throw new Error('Missing slug');
      return api.getPublicMenu(slug);
    },
    enabled: !!slug,
    retry: false,
  });

  const product: (PublicProduct & { modifierGroups?: ModifierGroup[] }) | null = useMemo(() => {
    if (!data || !productId) return null;
    return (data.products as (PublicProduct & { modifierGroups?: ModifierGroup[] })[]).find((p) => p.id === productId) ?? null;
  }, [data, productId]);

  const currency = data?.currency ?? 'EGP';
  const groups = product?.modifierGroups ?? [];

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    setSelected((prev) => {
      const set = new Set(prev[group.id] ?? []);
      const isSelected = set.has(optionId);
      if (group.maxSelect === 1) {
        return { ...prev, [group.id]: isSelected ? new Set() : new Set([optionId]) };
      }
      if (isSelected) set.delete(optionId);
      else {
        if (group.maxSelect > 0 && set.size >= group.maxSelect) return prev;
        set.add(optionId);
      }
      return { ...prev, [group.id]: set };
    });
  };

  const { data: directProduct } = useQuery({
    queryKey: ['publicProduct', slug, productId],
    queryFn: () => {
      if (!slug || !productId) throw new Error('Missing');
      return api.getPublicProduct(slug, productId);
    },
    enabled: !!slug && !!productId && !!product && (!product.modifierGroups || product.modifierGroups.length === 0),
    retry: false,
  });

  const effectiveProduct = directProduct ?? product;
  const effectiveGroups = (effectiveProduct as unknown as { modifierGroups?: ModifierGroup[] })?.modifierGroups ?? groups;

  const validationErrors = useMemo(() => {
    const errs: Record<string, string | null> = {};
    for (const g of effectiveGroups) {
      const count = selected[g.id]?.size ?? 0;
      if (count < g.minSelect) errs[g.id] = `Select at least ${String(g.minSelect)}`;
      else if (g.maxSelect > 0 && count > g.maxSelect) errs[g.id] = `Select at most ${String(g.maxSelect)}`;
      else errs[g.id] = null;
    }
    return errs;
  }, [effectiveGroups, selected]);

  const hasError = Object.values(validationErrors).some(Boolean);

  const basePrice = product?.priceMinor ?? 0;
  const delta = useMemo(() => {
    if (!effectiveGroups.length) return 0;
    let sum = 0;
    for (const g of effectiveGroups) {
      const sel = selected[g.id];
      if (!sel) continue;
      for (const optId of sel) {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) sum += opt.priceDeltaMinor;
      }
    }
    return sum;
  }, [effectiveGroups, selected]);

  const total = basePrice + delta;
  const canAdd = Boolean(product?.isAvailable && !hasError);

  if (!slug) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-zinc-500">
          Missing restaurant slug. Open via <code>/r/&lt;slug&gt;/products/{String(productId ?? '')}</code> or add <code>?slug=dev-restaurant</code>.
        </p>
        <Link href="/" className="text-sm text-zinc-900 underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (isLoading) return <main className="mx-auto max-w-2xl p-6 text-sm text-zinc-500">Loading product…</main>;
  if (isError)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Failed'}</p>
        <p className="mt-2 text-sm text-zinc-500">Product detail pending backend (task 8). This UI will show once menu endpoint includes product data.</p>
      </main>
    );
  if (!product)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-red-600">Product not found</p>
        <Link href={slug ? `/r/${slug}` : '/'} className="text-sm underline">
          Back to menu
        </Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={slug ? `/r/${slug}` : '/'} className="text-sm text-zinc-600 hover:underline">
        ← Back to menu
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border bg-white">
        {effectiveProduct?.imageUrl ? (
          <img src={effectiveProduct.imageUrl} alt={effectiveProduct.name} className="h-64 w-full object-cover" />
        ) : (
          <div className="flex h-64 items-center justify-center bg-zinc-100 text-zinc-500">No image</div>
        )}
        <div className="p-6">
          <h1 className="text-2xl font-bold">{effectiveProduct?.name ?? product.name}</h1>
          {effectiveProduct?.description && <p className="mt-2 text-sm text-zinc-600">{effectiveProduct.description}</p>}
          <p className="mt-3 text-lg font-semibold">
            {formatMoney(basePrice, currency)} <span className="text-sm font-normal text-zinc-500">base</span>
          </p>
          {!product.isAvailable && <p className="mt-1 text-sm text-amber-700">Currently unavailable</p>}
          {product.barcode && <p className="mt-1 text-xs text-zinc-400">Barcode: {product.barcode}</p>}

          {effectiveGroups.length > 0 ? (
            <div className="mt-6 space-y-6">
              <h2 className="font-semibold">Customize</h2>
              {effectiveGroups.map((g) => (
                <div key={g.id} className="rounded border p-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-medium">{g.name}</h3>
                    <span className="text-xs text-zinc-500">
                      {g.minSelect === 0 && g.maxSelect === 1
                        ? 'optional • pick one'
                        : g.maxSelect === 1
                          ? 'required • pick one'
                          : `pick ${String(g.minSelect)}–${String(g.maxSelect)}`}
                    </span>
                  </div>
                  {validationErrors[g.id] && <p className="mt-1 text-xs text-red-600">{validationErrors[g.id]}</p>}
                  <ul className="mt-3 space-y-2">
                    {g.options.map((opt: ModifierOption) => {
                      const isSelected = selected[g.id]?.has(opt.id) ?? false;
                      return (
                        <li key={opt.id} className="flex items-center justify-between rounded border px-3 py-2">
                          <label className="flex flex-1 cursor-pointer items-center gap-3">
                            <input
                              type={g.maxSelect === 1 ? 'radio' : 'checkbox'}
                              name={g.id}
                              checked={isSelected}
                              onChange={() => {
                                toggleOption(g, opt.id);
                              }}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">{opt.name}</span>
                          </label>
                          <span className="text-sm text-zinc-600">+{formatMoney(opt.priceDeltaMinor, currency)}</span>
                        </li>
                      );
                    })}
                    {g.options.length === 0 && <li className="text-xs text-zinc-500">No options</li>}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-zinc-500">No customization options for this product.</p>
          )}

          <div className="mt-8 rounded bg-zinc-50 p-4">
            <div className="flex justify-between text-sm">
              <span>Base</span>
              <span>{formatMoney(basePrice, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Modifiers</span>
              <span>+{formatMoney(delta, currency)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
            {hasError && <p className="mt-2 text-xs text-red-600">Fix selection errors above before adding to cart.</p>}
            <button
              disabled={!canAdd}
              className="mt-4 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-300 disabled:text-zinc-500"
              onClick={() => {
                alert(`Added to cart: ${product.name} — ${formatMoney(total, currency)}`);
              }}
            >
              {product.isAvailable ? (canAdd ? `Add to cart — ${formatMoney(total, currency)}` : 'Select options') : 'Unavailable'}
            </button>
            <p className="mt-2 text-center text-xs text-zinc-500">Price recalculated server-side at checkout (AGENTS.md).</p>
          </div>
        </div>
      </div>
    </main>
  );
}
