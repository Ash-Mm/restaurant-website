import 'reflect-metadata';
import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { customers, getDb, restaurants } from '@restaurant/db';
import { AppModule } from '../app.module.js';
import { applyMigrations, uniqueSlug, useInMemoryDb } from '../testing/sqlite.js';

useInMemoryDb();

interface GuestSessionResponse {
  customerId: string;
  trackingToken: string;
}

async function createRestaurant(slug: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(restaurants)
    .values({ name: 'Guest Cafe', slug, currency: 'EGP', timezone: 'UTC', defaultLanguage: 'en' })
    .returning({ id: restaurants.id });
  return String(row?.id);
}

describe('Guest order identity (integration)', () => {
  let app: INestApplication;
  let slug: string;
  let restaurantId: string;

  beforeAll(async () => {
    await applyMigrations();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
    );
    await app.init();
    slug = uniqueSlug('guest');
    restaurantId = await createRestaurant(slug);
  });

  async function openSession(body: Record<string, unknown> = {}, overrideSlug?: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/${overrideSlug ?? slug}/guest-session`)
      .send(body);
    return res;
  }

  it('creates a guest session and resolves it with the tracking token', async () => {
    const res = await openSession({ name: 'Walk-in Guest', email: 'guest@example.com' });
    expect(res.status).toBe(201);
    const session = res.body as GuestSessionResponse;
    expect(session.customerId).toBeDefined();
    expect(session.trackingToken).toBeDefined();
    expect(session.trackingToken.length).toBeGreaterThan(20);

    const resolved = await request(app.getHttpServer())
      .post('/api/v1/public/guest/resolve')
      .send({ restaurantSlug: slug, trackingToken: session.trackingToken })
      .expect(200);
    expect(resolved.body.customer.id).toBe(session.customerId);
    expect(resolved.body.customer.name).toBe('Walk-in Guest');
    expect(resolved.body.customer.email).toBe('guest@example.com');
  });

  it('allows a session without any profile fields', async () => {
    const res = await openSession();
    expect(res.status).toBe(201);
    const session = res.body as GuestSessionResponse;
    const resolved = await request(app.getHttpServer())
      .post('/api/v1/public/guest/resolve')
      .send({ restaurantSlug: slug, trackingToken: session.trackingToken })
      .expect(200);
    expect(resolved.body.customer.id).toBe(session.customerId);
    expect(resolved.body.customer.name).toBeNull();
  });

  it('rejects an unknown tracking token with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/public/guest/resolve')
      .send({ restaurantSlug: slug, trackingToken: 'not-a-real-token' })
      .expect(401);
  });

  it('rejects an expired tracking token with 401', async () => {
    const res = await openSession();
    const session = res.body as GuestSessionResponse;
    const db = getDb();
    await db
      .update(customers)
      .set({ trackingExpiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(customers.id, session.customerId));

    await request(app.getHttpServer())
      .post('/api/v1/public/guest/resolve')
      .send({ restaurantSlug: slug, trackingToken: session.trackingToken })
      .expect(401);
  });

  it('rejects a revoked tracking token with 401', async () => {
    const res = await openSession();
    const session = res.body as GuestSessionResponse;
    const db = getDb();
    await db
      .update(customers)
      .set({ trackingRevokedAt: new Date().toISOString() })
      .where(eq(customers.id, session.customerId));

    await request(app.getHttpServer())
      .post('/api/v1/public/guest/resolve')
      .send({ restaurantSlug: slug, trackingToken: session.trackingToken })
      .expect(401);
  });

  it('never resolves a token under another restaurant (tenant isolation)', async () => {
    const res = await openSession();
    const session = res.body as GuestSessionResponse;
    const otherSlug = uniqueSlug('other');
    await createRestaurant(otherSlug);

    await request(app.getHttpServer())
      .post('/api/v1/public/guest/resolve')
      .send({ restaurantSlug: otherSlug, trackingToken: session.trackingToken })
      .expect(401);
  });

  it('returns 404 for a guest session at an unknown restaurant slug', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/public/does-not-exist/guest-session')
      .send({})
      .expect(404);
  });

  it('rejects a session body with unknown fields (4xx)', async () => {
    const res = await openSession({ hack: true });
    expect(res.status).toBe(400);
  });
});
