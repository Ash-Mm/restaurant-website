import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/libsql/migrator';
import type { Database } from './client.js';

let migrated = false;

export function runMigrations(dbInstance: Database): Promise<void> {
  if (migrated) return Promise.resolve();
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  return migrate(dbInstance, { migrationsFolder }).then(() => {
    migrated = true;
  });
}
