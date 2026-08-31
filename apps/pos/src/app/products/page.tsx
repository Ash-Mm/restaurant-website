'use client';
/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-non-null-assertion */

import { useState, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Label } from '@restaurant/ui';
import { api, ApiError, type Product } from '../../lib/api';
import { ProtectedRoute } from '../../components/protected-route';

const productSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable().or(z.literal('')),
  barcode: z.string().trim().max(50).optional().nullable(),
  priceMinor: z.coerce.number().int().min(0, 'Price must be  0').optional(),
  isAvailable: z.boolean().optional(),
});

type FormValues = z.infer<typeof productSchema>;

function ModifierManager({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data: groups, isLoading } = useQuery({
    queryKey: ['modifierGroups', productId],
    queryFn: () => api.listModifierGroups(productId),
    retry: false,
  });

  const [groupName, setGroupName] = useState('');
  const [minSelect, setMinSelect] = useState(0);
  const [maxSelect, setMaxSelect] = useState(1);
  const [optionName, setOptionName] = useState<Record<string, string>>({});
  const [optionPrice, setOptionPrice] = useState<Record<string, string>>({});

  const createGroupMut = useMutation({
    mutationFn: () => api.createModifierGroup(productId, { name: groupName.trim(), minSelect, maxSelect }),
    onSuccess: () => {
      setGroupName('');
      void qc.invalidateQueries({ queryKey: ['modifierGroups', productId] });
    },
  });

  const deleteGroupMut = useMutation({
    mutationFn: (groupId: string) => api.deleteModifierGroup(productId, groupId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['modifierGroups', productId] }),
  });

  const createOptionMut = useMutation({
    mutationFn: ({ groupId, name, price }: { groupId: string; name: string; price: number }) =>
      api.createModifierOption(productId, groupId, { name, priceDeltaMinor: price }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['modifierGroups', productId] }),
  });

  const deleteOptionMut = useMutation({
    mutationFn: ({ groupId, optionId }: { groupId: string; optionId: string }) =>
      api.deleteModifierOption(productId, groupId, optionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['modifierGroups', productId] }),
  });

  if (isLoading) return <p className="text-xs text-zinc-500">Loading modifiers…</p>;

  const isGroupsError = !groups;
  return (
    <div className="mt-4 space-y-4 rounded border p-3">
      <h4 className="text-sm font-semibold">Modifier groups</h4>
      {isGroupsError && <p className="text-xs text-amber-700">Modifiers API pending (task 4/5 backend). Groups will appear once available.</p>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Group name</Label>
          <Input value={groupName} onChange={(e) => { setGroupName(e.target.value); }} placeholder="e.g. Size" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Min</Label>
          <Input type="number" min={0} value={minSelect} onChange={(e) => { setMinSelect(Number(e.target.value)); }} className="h-8 w-20 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Max</Label>
          <Input type="number" min={0} value={maxSelect} onChange={(e) => { setMaxSelect(Number(e.target.value)); }} className="h-8 w-20 text-sm" />
        </div>
        <Button size="sm" disabled={!groupName.trim() || createGroupMut.isPending} onClick={() => { createGroupMut.mutate(); }}>
          Add group
        </Button>
      </div>
      {(groups ?? []).length === 0 ? (
        <p className="text-xs text-zinc-500">No modifier groups yet.</p>
      ) : (
        <ul className="space-y-3">
          {(groups ?? []).map((g) => (
            <li key={g.id} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {g.name} <span className="text-xs text-zinc-500">min {g.minSelect} / max {g.maxSelect}</span>
                </span>
                <Button variant="destructive" size="sm" onClick={() => { deleteGroupMut.mutate(g.id); }}>Delete</Button>
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Option name"
                  value={optionName[g.id] ?? ''}
                  onChange={(e) => { setOptionName((s) => ({ ...s, [g.id]: e.target.value })); }}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Price delta (minor, e.g. 50 = 0.50)"
                  value={optionPrice[g.id] ?? ''}
                  onChange={(e) => { setOptionPrice((s) => ({ ...s, [g.id]: e.target.value })); }}
                  className="h-8 w-32 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!(optionName[g.id] ?? '').trim() || createOptionMut.isPending}
                  onClick={() => {
                    const name = (optionName[g.id] ?? '').trim();
                    const price = Number(optionPrice[g.id] ?? '0') || 0;
                    if (!name) return;
                    createOptionMut.mutate({ groupId: g.id, name, price });
                    setOptionName((s) => ({ ...s, [g.id]: '' }));
                    setOptionPrice((s) => ({ ...s, [g.id]: '' }));
                  }}
                >
                  Add option
                </Button>
              </div>
              <ul className="mt-2 space-y-1">
                {g.options.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1 text-xs">
                    <span>
                      {o.name} <span className="text-zinc-500">+{(o.priceDeltaMinor / 100).toFixed(2)}</span>
                    </span>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => { deleteOptionMut.mutate({ groupId: g.id, optionId: o.id }); }}
                    >
                      remove
                    </button>
                  </li>
                ))}
                {g.options.length === 0 && <li className="text-xs text-zinc-500">No options</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductsInner() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.listCategories(), retry: false });
  const { data: products, isLoading, isError, error } = useQuery({ queryKey: ['products'], queryFn: () => api.listProducts(), retry: false });

  const form = useForm<FormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', description: '', imageUrl: '', categoryId: '', barcode: '', priceMinor: 0, isAvailable: true },
  });

  const createMut = useMutation({
    mutationFn: (values: FormValues) =>
      api.createProduct({
        name: values.name,
        description: values.description ?? null,
        imageUrl: imageUrl ?? (values.imageUrl || null),
        categoryId: (values.categoryId!) || null,
        barcode: values.barcode ?? null,
        priceMinor: values.priceMinor ?? 0,
        isAvailable: values.isAvailable ?? true,
      }),
    onSuccess: () => {
      form.reset({ name: '', description: '', imageUrl: '', categoryId: '', barcode: '', priceMinor: 0, isAvailable: true });
      setImageUrl(null);
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) =>
      api.updateProduct(id, {
        name: values.name,
        description: values.description ?? null,
        imageUrl: imageUrl ?? (values.imageUrl || null),
        categoryId: (values.categoryId!) || null,
        barcode: values.barcode ?? null,
        priceMinor: values.priceMinor ?? 0,
        isAvailable: values.isAvailable,
      }),
    onSuccess: () => {
      setEditingId(null);
      setImageUrl(null);
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploadFile(file);
      setImageUrl(url);
      form.setValue('imageUrl', url);
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = form.handleSubmit((v) => {
    if (editingId) updateMut.mutate({ id: editingId, values: v });
    else createMut.mutate(v);
  });

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setSelectedId(p.id);
    setImageUrl(p.imageUrl);
    form.reset({
      name: p.name,
      description: p.description ?? '',
      imageUrl: p.imageUrl ?? '',
      categoryId: p.categoryId ?? '',
      barcode: p.barcode ?? '',
      priceMinor: p.priceMinor,
      isAvailable: p.isAvailable,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setImageUrl(null);
    form.reset({ name: '', description: '', imageUrl: '', categoryId: '', barcode: '', priceMinor: 0, isAvailable: true });
  };

  const backendMissing = isError && error instanceof ApiError && (error.status === 404 || error.status === 501);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-xl font-semibold">Product management</h1>
      <p className="mb-4 text-sm text-zinc-500">Create products with images, categories, barcodes and modifiers. Price is stored as minor units (e.g. 1999 = 19.99).</p>

      {isLoading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {backendMissing && (
        <Card className="mb-4 border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Products API not yet available (tasks 3,6 backend pending). UI is ready — connect will happen once <code className="bg-white px-1">GET /admin/products</code> exists.
          </CardContent>
        </Card>
      )}
      {isError && !backendMissing && (
        <p className="mb-4 text-sm text-red-600">Failed: {error instanceof ApiError ? `${error.status} ${error.message}` : 'unknown'}</p>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Edit product' : 'Add product'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input id="name" {...form.register('name')} placeholder="Margherita Pizza" />
                {form.formState.errors.name && <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="categoryId">Category</Label>
                <select id="categoryId" {...form.register('categoryId')} className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm">
                  <option value="">No category</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <textarea id="description" {...form.register('description')} className="w-full rounded border border-zinc-300 p-2 text-sm" rows={2} placeholder="Fresh tomatoes, mozzarella..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="priceMinor">Price minor (e.g. 1500 = 15.00)</Label>
                <Input id="priceMinor" type="number" min={0} {...form.register('priceMinor')} />
              </div>
              <div>
                <Label htmlFor="barcode">Barcode</Label>
                <Input id="barcode" {...form.register('barcode')} placeholder="Optional" />
              </div>
            </div>
            <div>
              <Label>Image</Label>
              <div className="flex gap-2">
                <Input type="file" accept="image/*" onChange={(e) => void onFile(e)} className="text-sm" />
                {uploading && <span className="text-xs text-zinc-500">Uploading…</span>}
                {imageUrl && <span className="text-xs text-green-600 truncate">{imageUrl}</span>}
              </div>
              <Input {...form.register('imageUrl')} placeholder="or paste image URL" className="mt-2 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('isAvailable')} />
              Available
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingId ? (updateMut.isPending ? 'Saving…' : 'Save changes') : createMut.isPending ? 'Adding…' : 'Add product'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
            {(createMut.isError || updateMut.isError) && (
              <p className="text-xs text-red-600">
                Failed: {(() => {
                  const err = (createMut.error ?? updateMut.error) as unknown;
                  return err instanceof ApiError ? String(err.status) : 'unknown';
                })()}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(products ?? []).length === 0 ? (
          <p className="text-sm text-zinc-500">No products yet.</p>
        ) : (
          (products ?? []).map((p) => (
            <Card key={p.id} className={selectedId === p.id ? 'border-zinc-900' : ''}>
              <CardContent className="flex gap-4 p-4">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="h-16 w-16 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-500">No img</div>
                )}
                <div className="flex-1">
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="text-xs text-zinc-500 line-clamp-2">{p.description ?? 'No description'}</p>
                  <p className="mt-1 text-sm">
                    {(p.priceMinor / 100).toFixed(2)} EGP{' '}
                    <span className={p.isAvailable ? 'text-green-600' : 'text-amber-600'}>· {p.isAvailable ? 'Available' : 'Hidden'}</span>
                    {p.barcode ? <span className="text-zinc-400"> · {p.barcode}</span> : null}
                  </p>
                  <p className="text-xs text-zinc-400">Category: {(categories ?? []).find((c) => c.id === p.categoryId)?.name ?? '—'}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => { startEdit(p); }}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedId(selectedId === p.id ? null : p.id); }}>
                    {selectedId === p.id ? 'Hide modifiers' : 'Modifiers'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { deleteMut.mutate(p.id); }}>Delete</Button>
                </div>
              </CardContent>
              {selectedId === p.id && (
                <CardContent className="pt-0">
                  <ModifierManager productId={p.id} />
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </main>
  );
}

export default function ProductsPage() {
  return (
    <ProtectedRoute>
      <ProductsInner />
    </ProtectedRoute>
  );
}
