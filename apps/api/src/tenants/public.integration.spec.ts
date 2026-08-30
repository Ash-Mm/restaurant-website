import 'reflect-metadata';
import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDb } from '@restaurant/db';
import { AppModule } from '../app.module.js';

process.env.DATABASE_URL = 'file::memory:?cache=shared';

function uniqueSlug(prefix: string): string {
  return `${prefix}-${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`;
}

async function applyMigrations(): Promise<void> {
  const dir = join(__dirname, '../../../../packages/db/drizzle');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
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

const validTenant = (slug: string, email: string) => ({
  name: 'Test Restaurant',
  slug,
  fullName: 'Owner Person',
  email,
  password: 'Sup3rSecret!',
  currency: 'EGP',
  timezone: 'Africa/Cairo',
  defaultLanguage: 'en',
});

describe('Public tenant resolution & branding (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await applyMigrations();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
    );
    await app.init();
  });

  it('resolves the public profile by slug', async () => {
    const slug = uniqueSlug('pub');
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(slug, `${slug}@example.com`))
      .expect(201);

    const res = await request(app.getHttpServer()).get(`/api/v1/public/${slug}/menu`).expect(200);
    expect(res.body.slug).toBe(slug);
    expect(res.body.name).toBe('Test Restaurant');
    expect(Array.isArray(res.body.locations)).toBe(true);
    expect(res.body.locations.length).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown slug', async () => {
    await request(app.getHttpServer()).get('/api/v1/public/does-not-exist/menu').expect(404);
  });

  it('updates branding and reflects it on the public profile', async () => {
    const slug = uniqueSlug('brand');
    const email = `${slug}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(slug, email))
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email, password: 'Sup3rSecret!', restaurantSlug: slug })
      .expect(200);
    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .patch('/api/v1/admin/settings/branding')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Restaurant-Slug', slug)
      .send({ brandColor: '#1A2B3C', receiptFooter: 'Thanks for visiting!' })
      .expect(200);

    const res = await request(app.getHttpServer()).get(`/api/v1/public/${slug}/menu`).expect(200);
    expect(res.body.brandColor).toBe('#1A2B3C');
    expect(res.body.receiptFooter).toBe('Thanks for visiting!');
  });
});
