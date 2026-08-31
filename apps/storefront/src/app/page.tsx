'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type PublicProduct } from '../lib/api';
import Link from 'next/link';

function getSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const match = /^\/r\/([^/]+)/.exec(window.location.pathname);
  if (match) return match[1] ?? null;
  const params = new URLSearchParams(window.location.search);
  return params.get('slug');
}

function ProductCard({ product, currency }: { product: PublicProduct; currency: string }) {
  const price = (product.priceMinor / 100).toFixed(2);
  const isAvailable = product.isAvailable;
  const detailHref = `${typeof window !== 'undefined' ? window.location.pathname : ''}/products/${product.id}`.replace('//', '/');
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">No image</div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold leading-tight">{product.name}</h3>
        {product.description && <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{product.description}</p>}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-medium">
            {price} {currency}
          </span>
          {!isAvailable && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Out of stock</span>}
        </div>
        <div className="mt-3">
          {isAvailable ? (
            <Link
              href={detailHref}
              className="block w-full rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800"
            >
              View details
            </Link>
          ) : (
            <button disabled className="w-full rounded-md bg-zinc-200 px-3 py-2 text-sm text-zinc-500">
              Unavailable
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PublicMenuPage() {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    setSlug(getSlugFromLocation());
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['publicMenu', slug],
    queryFn: () => {
      if (!slug) throw new Error('Missing slug');
      return api.getPublicMenu(slug);
    },
    enabled: !!slug,
    retry: false,
  });

  const categories = data?.categories ?? [];
  const products = data?.products ?? [];
  const currency = data?.currency ?? 'EGP';

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      const first = categories[0];
      if (first) setActiveCategory(first.id);
    }
  }, [categories, activeCategory]);

  const filtered = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((p) => p.categoryId === activeCategory);
  }, [products, activeCategory]);

  const uncategorized = useMemo(() => products.filter((p) => !p.categoryId), [products]);

  if (!slug) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold">Welcome to our Restaurant</h1>
        <p className="mt-2 text-zinc-600">
          Visit your restaurant menu at <code className="rounded bg-zinc-100 px-1">/r/&lt;slug&gt;</code> or add <code className="rounded bg-zinc-100 px-1">?slug=dev-restaurant</code> to this URL.
        </p>
        <p className="mt-4 text-sm text-zinc-500">
          Example: <Link href="/r/dev-restaurant" className="text-zinc-900 underline">/r/dev-restaurant</Link>
        </p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-sm text-zinc-500">Loading menu for {slug}…</p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-xl font-semibold">Menu not available</h1>
        <p className="mt-2 text-sm text-red-600">{error instanceof Error ? error.message : 'Failed to load'}</p>
        <p className="mt-2 text-sm text-zinc-500">
          The public menu endpoint may still be pending (task 8 backend). This page is ready and will show data once <code>GET /public/:slug/menu</code>{' '}
          returns categories and products.
        </p>
      </main>
    );
  }

  const initial = data?.name ? data.name[0] : 'R';
  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center gap-4">
        {data?.logoUrl ? (
          <img src={data.logoUrl} alt={data.name} className="h-12 w-12 rounded object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-900 text-white">{initial}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{data?.name ?? slug}</h1>
          <p className="text-sm text-zinc-500">
            {String(products.length)} products · {String(categories.length)} categories
          </p>
        </div>
        {data?.brandColor && <span className="ml-auto hidden h-6 w-6 rounded-full border md:block" style={{ background: data.brandColor }} aria-hidden />}
      </header>

      {categories.length === 0 && products.length === 0 ? (
        <p className="text-sm text-zinc-500">No menu items yet. The restaurant owner can add categories and products in the POS.</p>
      ) : (
        <>
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => {
                setActiveCategory(null);
              }}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${activeCategory === null ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${activeCategory === cat.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
              >
                {cat.name}
              </button>
            ))}
            {uncategorized.length > 0 && (
              <button
                onClick={() => {
                  setActiveCategory('uncategorized');
                }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${activeCategory === 'uncategorized' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
              >
                Other
              </button>
            )}
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(activeCategory === 'uncategorized' ? uncategorized : activeCategory === null ? products : filtered).map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
            {(activeCategory === 'uncategorized' ? uncategorized : activeCategory === null ? products : filtered).length === 0 && (
              <p className="col-span-full text-sm text-zinc-500">No products in this category.</p>
            )}
          </section>

          {data?.receiptHeader && <p className="mt-8 text-center text-sm text-zinc-500">{data.receiptHeader}</p>}
          {data?.receiptFooter && <p className="text-center text-xs text-zinc-400">{data.receiptFooter}</p>}
        </>
      )}
    </main>
  );
}
