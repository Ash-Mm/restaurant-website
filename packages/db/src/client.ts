import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { schema } from './schema/index';

function resolveDbUrl(url: string | undefined): string {
  return url ?? 'file:./dev.db';
}

let client: Client | null = null;
let db: LibSQLDatabase<typeof schema> | null = null;

export function getClient(): Client {
  client ??= createClient({ url: resolveDbUrl(process.env.DATABASE_URL) });
  return client;
}

export function getDb(): LibSQLDatabase<typeof schema> {
  db ??= drizzle(getClient(), { schema });
  return db;
}
