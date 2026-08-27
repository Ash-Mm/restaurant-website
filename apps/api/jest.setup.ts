import 'reflect-metadata';

// The API auto-runs migrations on boot. Tests manage their own in-memory
// database and apply migrations directly, so make runMigrations a no-op.
// (Migrate.ts uses import.meta.url which Jest's CommonJS transform can't parse,
// so we avoid loading it in the test environment entirely.)
jest.mock('@restaurant/db/migrate', () => ({
  runMigrations: jest.fn().mockResolvedValue(undefined),
}));
