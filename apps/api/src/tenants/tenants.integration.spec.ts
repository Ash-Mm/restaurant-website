import 'reflect-metadata';
import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { getDb, roles, restaurants, users } from '@restaurant/db';
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

  async function login(email: string, slug: string, password = 'password123'): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email, password, restaurantSlug: slug })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function createTenantAndLogin(slug: string, email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(slug, email))
      .expect(201);
    return login(email, slug);
  }

  const adminHeaders = (token: string, slug: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
    'X-Restaurant-Slug': slug,
  });

  it('creates a tenant with owner role and default location', async () => {
    const slug = uniqueSlug('t');
    const email = `${slug}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(slug, email))
      .expect(201);

    const settings = await request(app.getHttpServer())
      .get('/api/v1/admin/settings')
      .set(adminHeaders(await login(email, slug), slug))
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

  it('rejects settings access without a bearer token (401)', async () => {
    const slug = uniqueSlug('noauth');
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(slug, `${slug}@example.com`))
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/admin/settings')
      .set('X-Restaurant-Slug', slug)
      .expect(401);
  });

  it('rejects cross-tenant access with 403 (token from another restaurant)', async () => {
    const a = uniqueSlug('xt-a');
    const b = uniqueSlug('xt-b');
    const tokenA = await createTenantAndLogin(a, `${a}@example.com`);
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(b, `${b}@example.com`))
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/admin/settings')
      .set(adminHeaders(tokenA, b))
      .expect(403);
  });

  it('rejects a user whose role lacks the required permission (403)', async () => {
    const slug = uniqueSlug('rbac');
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send(validTenant(slug, `${slug}@example.com`))
      .expect(201);

    const db = getDb();
    const [restaurant] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    expect(restaurant).toBeDefined();
    const restaurantId = String(restaurant?.id);
    await db.insert(roles).values({
      restaurantId,
      name: 'cashier',
      permissions: '[]',
    });
    const cashierEmail = `${slug}-cashier@example.com`;
    await db.insert(users).values({
      restaurantId,
      email: cashierEmail,
      passwordHash: await hash('password123'),
      fullName: 'Cashier One',
      role: 'cashier',
    });

    const token = await login(cashierEmail, slug);
    await request(app.getHttpServer())
      .post('/api/v1/admin/locations')
      .set(adminHeaders(token, slug))
      .send({ name: 'Branch Two' })
      .expect(403);
  });

  it('creates and lists locations scoped to the tenant', async () => {
    const slug = uniqueSlug('loc');
    const token = await createTenantAndLogin(slug, `${slug}@example.com`);

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/locations')
      .set(adminHeaders(token, slug))
      .send({ name: 'Branch Two' })
      .expect(201);
    expect(created.body.name).toBe('Branch Two');

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/locations')
      .set(adminHeaders(token, slug))
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((l: { id: string }) => l.id === created.body.id)).toBe(true);
  });

  it('updates a location and enforces tenant isolation', async () => {
    const a = uniqueSlug('iso-a');
    const b = uniqueSlug('iso-b');
    const tokenA = await createTenantAndLogin(a, `${a}@example.com`);
    await createTenantAndLogin(b, `${b}@example.com`);

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/locations')
      .set(adminHeaders(tokenA, a))
      .send({ name: 'A Branch' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/locations/${String(created.body.id)}`)
      .set(adminHeaders(tokenA, a))
      .send({ name: 'A Branch Renamed' })
      .expect(200);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/admin/locations')
      .set(adminHeaders(await login(`${b}@example.com`, b), b))
      .expect(200);
    const idsB = listB.body.map((l: { id: string }) => l.id);
    expect(Array.isArray(listB.body)).toBe(true);
    expect(idsB).not.toContain(created.body.id);
  });
});
