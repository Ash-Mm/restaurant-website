'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@restaurant/ui';
import { api, ApiError } from '../../lib/api';

const schema = z.object({
  name: z.string().min(2, 'Branch name is required'),
  address: z.string().optional(),
  active: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

const inputCls = 'w-full rounded border border-gray-300 p-2 text-sm';

export default function LocationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['locations'], queryFn: api.listLocations });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { active: true } });

  const submit = handleSubmit((v) => {
    mutation.mutate({ name: v.name, address: v.address, active: v.active });
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.createLocation({ name: values.name, address: values.address ?? null, active: values.active }),
    onSuccess: () => {
      reset({ name: '', address: '', active: true });
      void qc.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Locations</h1>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <ul className="mb-6 space-y-2">
          {(data ?? []).map((loc) => (
            <li key={loc.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <span>
                {loc.name}
                {loc.address ? <span className="text-gray-500"> — {loc.address}</span> : null}
              </span>
              <span className={loc.active ? 'text-green-600' : 'text-gray-400'}>
                {loc.active ? 'Active' : 'Disabled'}
              </span>
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="text-sm text-gray-500">No locations yet.</li>}
        </ul>
      )}

      <form
        onSubmit={(e) => { void submit(e); }}
        className="space-y-3 rounded border p-4"
      >
        <h2 className="font-medium">Add a branch</h2>
        <div>
          <input className={inputCls} placeholder="Branch name" {...register('name')} />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <input className={inputCls} placeholder="Address (optional)" {...register('address')} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('active')} />
          Active
        </label>
        {mutation.isError && (
          <p className="text-xs text-red-600">
            {mutation.error instanceof ApiError ? `Failed (${String(mutation.error.status)})` : 'Failed to add location'}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? 'Saving…' : 'Add location'}
        </Button>
      </form>
    </main>
  );
}
