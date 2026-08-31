'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Label } from '@restaurant/ui';
import { api, ApiError } from '../../lib/api';
import { ProtectedRoute } from '../../components/protected-route';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
});

type FormValues = z.infer<typeof schema>;

function SortableItem({
  id,
  name,
  onEdit,
  onDelete,
}: {
  id: string;
  name: string;
  onEdit: (id: string, current: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded border border-zinc-200 bg-white p-3 text-sm"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cursor-grab rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          ⋮⋮
        </button>
        <span className="font-medium">{name}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => { onEdit(id, name); }}>
          Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={() => { onDelete(id); }}>
          Delete
        </Button>
      </div>
    </li>
  );
}

function CategoriesInner() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.listCategories(),
    retry: false,
  });

  const categories = useMemo(() => {
    if (!data) return [];
    // ensure sorted by sortOrder
    return [...data].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  const [localOrder, setLocalOrder] = useState<typeof categories>([]);
  useEffect(() => {
    setLocalOrder(categories);
  }, [categories]);

  const createMut = useMutation({
    mutationFn: (values: FormValues) => api.createCategory({ name: values.name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateCategory(id, { name }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const reorderMut = useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderCategories({ orderedIds }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: () => {
      // rollback to server order
      setLocalOrder(categories);
    },
  });

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  const onCreate = handleSubmit((v) => {
    createMut.mutate(v, {
      onSuccess: () => { reset({ name: '' }); },
    });
  });

  const onEdit = (id: string, current: string) => {
    setEditingId(id);
    setEditName(current);
  };

  const onSaveEdit = () => {
    if (!editingId) return;
    const name = editName.trim();
    if (name.length < 2) return;
    updateMut.mutate({ id: editingId, name }, { onSuccess: () => { setEditingId(null); } });
  };

  const onDelete = (id: string) => {
    if (!confirm('Delete this category? Products will keep their category but it will be unassigned.')) return;
    deleteMut.mutate(id);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localOrder.findIndex((c) => c.id === String(active.id));
    const newIndex = localOrder.findIndex((c) => c.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(localOrder, oldIndex, newIndex);
    setLocalOrder(next);
    const orderedIds = next.map((c) => c.id);
    reorderMut.mutate(orderedIds);
  };

  const backendMissing = isError && error instanceof ApiError && (error.status === 404 || error.status === 501);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-xl font-semibold">Category management</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Drag to reorder. Order controls how categories appear on the public menu.
      </p>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading categories…</p>
      ) : backendMissing ? (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Categories API not yet available (friend&apos;s tasks 1 & 10 backend pending). UI is ready — will connect once{' '}
            <code className="rounded bg-white px-1">GET /admin/categories</code> is implemented. You can still test
            drag-and-drop locally.
          </CardContent>
        </Card>
      ) : isError ? (
        <p className="mb-4 text-sm text-red-600">
          Failed to load categories: {error instanceof ApiError ? `${String(error.status)} ${error.message}` : 'Unknown error'}
        </p>
      ) : null}

      {/* Create form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              void onCreate(e);
            }}
            className="flex gap-2"
          >
            <div className="flex-1">
              <Label htmlFor="name" className="sr-only">
                Category name
              </Label>
              <Input id="name" placeholder="e.g. Appetizers" {...register('name')} />
              {formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">{formState.errors.name.message}</p>
              )}
            </div>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? 'Adding…' : 'Add'}
            </Button>
          </form>
          {createMut.isError && (
            <p className="mt-2 text-xs text-red-600">
              {createMut.error instanceof ApiError ? `Failed (${String(createMut.error.status)})` : 'Failed to add'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* List with drag */}
      {localOrder.length === 0 ? (
        <p className="text-sm text-zinc-500">No categories yet. Add one above.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={localOrder.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {localOrder.map((cat) => (
                <SortableItem
                  key={cat.id}
                  id={cat.id}
                  name={editingId === cat.id ? editName : cat.name}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* Inline edit bar */}
      {editingId && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input value={editName} onChange={(e) => { setEditName(e.target.value); }} placeholder="Category name" />
              <Button onClick={onSaveEdit} disabled={updateMut.isPending}>
                Save
              </Button>
              <Button variant="outline" onClick={() => { setEditingId(null); }}>
                Cancel
              </Button>
            </div>
            {updateMut.isError && (
              <p className="mt-2 text-xs text-red-600">
                {updateMut.error instanceof ApiError ? `Failed (${String(updateMut.error.status)})` : 'Failed'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {reorderMut.isPending && <p className="mt-2 text-xs text-zinc-500">Saving order…</p>}
      {deleteMut.isPending && <p className="mt-2 text-xs text-zinc-500">Deleting…</p>}
    </main>
  );
}

export default function CategoriesPage() {
  return (
    <ProtectedRoute>
      <CategoriesInner />
    </ProtectedRoute>
  );
}
