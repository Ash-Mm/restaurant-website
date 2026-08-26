import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';

function resolveDbUrl(url: string | undefined): string {
  return url ?? 'file:./dev.db';
}

let client: Client | null = null;
let db: LibSQLDatabase | null = null;

export function getClient(): Client {
  client ??= createClient({ url: resolveDbUrl(process.env.DATABASE_URL) });
  return client;
}

export function getDb(): LibSQLDatabase {
  db ??= drizzle(getClient());
  return db;
}
