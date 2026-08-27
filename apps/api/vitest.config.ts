import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => path.resolve(root, '../../packages', name, 'src/index.ts');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@restaurant/db': pkg('db'),
      '@restaurant/contracts': pkg('contracts'),
      '@restaurant/config': pkg('config'),
      '@restaurant/ui': pkg('ui'),
    },
  },
});
