import 'reflect-metadata';
import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { applyMigrations, uniqueSlug, useInMemoryDb } from '../testing/sqlite.js';

useInMemoryDb();
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

describe('Staff auth (integration)', () => {
  let app: INestApplication;
  const password = 'password123';

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

  async function createTenant(slug: string, email: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .send({
        name: 'Test Restaurant',
        slug,
        fullName: 'Owner Person',
        email,
        password,
        currency: 'EGP',
      })
      .expect(201);
  }

  it('logs in with valid credentials and sets an httpOnly refresh cookie', async () => {
    const slug = uniqueSlug('auth');
    const email = `${slug}@example.com`;
    await createTenant(slug, email);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email, password })
      .expect(200);

    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.split('.').length).toBe(3);
    expect(res.body.user).toMatchObject({ email, role: 'owner' });

    const cookies = res.headers['set-cookie'];
    expect(Array.isArray(cookies)).toBe(true);
    const refreshCookie = (cookies as string[]).find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/api/v1/auth/staff');
    expect(refreshCookie).toContain('SameSite=Lax');
    // The raw refresh token must never appear in the response body.
    const rawToken = String(refreshCookie).split(';')[0].split('=')[1];
    expect(JSON.stringify(res.body)).not.toContain(rawToken);
  });

  it('rejects a wrong password with a generic 401', async () => {
    const slug = uniqueSlug('auth-wrong');
    const email = `${slug}@example.com`;
    await createTenant(slug, email);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email, password: 'not-the-password' })
      .expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects an unknown email with the same generic 401 message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email: 'nobody-else@example.com', password })
      .expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects an unknown restaurant slug with 401', async () => {
    const slug = uniqueSlug('auth-slug');
    const email = `${slug}@example.com`;
    await createTenant(slug, email);

    await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email, password, restaurantSlug: 'does-not-exist' })
      .expect(401);
  });

  it('disambiguates a shared email across tenants via restaurantSlug', async () => {
    const a = uniqueSlug('auth-iso-a');
    const b = uniqueSlug('auth-iso-b');
    const sharedEmail = `${a}@example.com`;
    await createTenant(a, sharedEmail);
    await createTenant(b, sharedEmail);

    // Without a slug the email is ambiguous and login must fail closed.
    await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email: sharedEmail, password })
      .expect(401);

    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email: sharedEmail, password, restaurantSlug: a })
      .expect(200);
    expect(resA.body.user.email).toBe(sharedEmail);

    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email: sharedEmail, password, restaurantSlug: b })
      .expect(200);
    expect(resB.body.accessToken).not.toBe(resA.body.accessToken);
  });

  it('rejects an invalid payload with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);
  });
});
