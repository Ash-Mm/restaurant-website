import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { schema } from './schema/index.js';

function resolveDbUrl(url: string | undefined): string {
  return url ?? 'file:./dev.db';
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
