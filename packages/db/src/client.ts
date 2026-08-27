import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { schema } from './schema/index.js';

function resolveDbUrl(url: string | undefined): string {
  const raw = url ?? 'file:./dev.db';
  if (!raw.startsWith('file:')) {
    return raw;
  }
  const relative = raw.slice('file:'.length);
  // In-memory databases and file URLs with query params (e.g. ?cache=shared)
  // cannot be resolved as relative paths, so pass them through unchanged.
  if (relative.startsWith(':memory:') || relative.includes('?')) {
    return raw;
  }
  const absolute = path.isAbsolute(relative)
    ? relative
    : path.resolve(process.cwd(), relative);
  return 'file:' + absolute.replace(/\\/g, '/');
}

export type Database = LibSQLDatabase<typeof schema> & { $client: Client };

let client: Client | null = null;
let db: Database | null = null;

export function getClient(): Client {
  client ??= createClient({ url: resolveDbUrl(process.env.DATABASE_URL) });
  return client;
}

export function getDb(): Database {
  db ??= drizzle(getClient(), { schema });
  return db;
}
