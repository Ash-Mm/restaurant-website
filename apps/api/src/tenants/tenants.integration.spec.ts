import 'reflect-metadata';
import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { applyMigrations, uniqueSlug, useInMemoryDb } from '../testing/sqlite.js';

useInMemoryDb();

describe('Tenant & location CRUD (integration)', () => {
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

  const validTenant = (slug: string, email: string) => ({
    name: 'Test Restaurant',
    slug,
    fullName: 'Owner Person',
    email,
    password: 'password123',
    currency: 'EGP',
  });

  it('creates a tenant with owner role and default location', async () => {
    const slug = uniqueSlug('t');
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(slug, `${slug}@example.com`))
      .expect(201);
    expect(res.body.slug).toBe(slug);
    expect(res.body.locationId).toBeDefined();

    const settings = await request(app.getHttpServer())
      .get('/api/v1/admin/settings')
      .set('X-Restaurant-Slug', slug)
      .expect(200);
    expect(settings.body.currency).toBe('EGP');
  });

  it('rejects a duplicate slug with 409', async () => {
    const slug = uniqueSlug('dup');
    const payload = validTenant(slug, `${slug}@example.com`);
    await request(app.getHttpServer()).post('/api/v1/admin/tenants').send(payload).expect(201);
    await request(app.getHttpServer()).post('/api/v1/admin/tenants').send(payload).expect(409);
  });

  it('rejects settings access without X-Restaurant-Slug (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/settings').expect(401);
  });

  it('creates and lists locations scoped to the tenant', async () => {
    const slug = uniqueSlug('loc');
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(slug, `${slug}@example.com`))
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/locations')
      .set('X-Restaurant-Slug', slug)
      .send({ name: 'Branch Two' })
      .expect(201);
    expect(created.body.name).toBe('Branch Two');

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/locations')
      .set('X-Restaurant-Slug', slug)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((l: { id: string }) => l.id === created.body.id)).toBe(true);
  });

  it('updates a location and enforces tenant isolation', async () => {
    const a = uniqueSlug('iso-a');
    const b = uniqueSlug('iso-b');
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(a, `${a}@example.com`))
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(b, `${b}@example.com`))
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/locations')
      .set('X-Restaurant-Slug', a)
      .send({ name: 'A Branch' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/locations/${String(created.body.id)}`)
      .set('X-Restaurant-Slug', a)
      .send({ name: 'A Branch Renamed' })
      .expect(200);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/admin/locations')
      .set('X-Restaurant-Slug', b)
      .expect(200);
    const idsB = listB.body.map((l: { id: string }) => l.id);
    expect(Array.isArray(listB.body)).toBe(true);
    expect(idsB).not.toContain(created.body.id);
  });
});
