import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { getDb } from '@restaurant/db';

/**
 * Shared in-memory SQLite test helper. Each Jest worker process gets its own
 * shared-cache in-memory database; migrations are applied from the generated
 * SQL files in packages/db/drizzle.
 */
export async function applyMigrations(): Promise<void> {
  const dir = join(__dirname, '../../../../packages/db/drizzle');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const client = getDb().$client;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/-->[^\n]*\n/g, '');
    for (const raw of sql.split(';')) {
      const stmt = raw
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
      if (stmt) {
        await client.execute(stmt);
      }
    }
  }
}

export function useInMemoryDb(): void {
  process.env.DATABASE_URL = 'file::memory:?cache=shared';
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`;
}
