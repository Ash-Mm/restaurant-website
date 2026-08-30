import 'reflect-metadata';

// The API auto-runs migrations on boot. Tests manage their own in-memory
// database and apply migrations directly, so make runMigrations a no-op.
// (Migrate.ts uses import.meta.url which Jest's CommonJS transform can't parse,
// so we avoid loading it in the test environment entirely.)
jest.mock('@restaurant/db/migrate', () => ({
  runMigrations: jest.fn().mockResolvedValue(undefined),
}));

// Keep the login rate limiter out of the way for normal test flows. The
// dedicated rate-limit integration test overrides this to the real value
// before compiling its own app instance.
process.env.LOGIN_RATE_LIMIT ??= '1000';
