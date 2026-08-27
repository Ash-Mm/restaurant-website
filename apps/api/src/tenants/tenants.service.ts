import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getDb, restaurants, schema } from '@restaurant/db';
import { TenantRepository } from '../auth/tenant.repository.js';
import type { CreateTenantDto } from './dto/create-tenant.dto.js';
import type { UpdateSettingsDto } from './dto/settings.dto.js';

@Injectable()
export class TenantsService {
  constructor(private readonly repo: TenantRepository) {}

  async createTenant(dto: CreateTenantDto): Promise<{
    id: string;
    slug: string;
    userId: string;
    locationId: string;
  }> {
    const existing = await this.repo.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException('Slug already taken');
    }
    const passwordHash = await hash(dto.password);
    const result = await getDb().transaction(async (tx) => {
      const db = tx as unknown as LibSQLDatabase<typeof schema>;
      const restaurant = await this.repo.insertRestaurant(
        {
          name: dto.name,
          slug: dto.slug,
          currency: dto.currency,
          timezone: dto.timezone,
          defaultLanguage: dto.defaultLanguage,
        },
        db
      );
      await this.repo.insertRole(
        { restaurantId: restaurant.id, name: 'owner', permissions: JSON.stringify(['*']) },
        db
      );
      const user = await this.repo.insertUser(
        {
          restaurantId: restaurant.id,
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          role: 'owner',
        },
        db
      );
      const location = await this.repo.insertLocation(
        { restaurantId: restaurant.id, name: 'Main Branch', active: 1 },
        db
      );
      await this.repo.insertUserLocation(
        { restaurantId: restaurant.id, userId: user.id, locationId: location.id },
        db
      );
      return { restaurant, user, location };
    });
    return {
      id: result.restaurant.id,
      slug: result.restaurant.slug,
      userId: result.user.id,
      locationId: result.location.id,
    };
  }

  async getSettings(restaurantId: string): Promise<{
    currency: string;
    timezone: string;
    defaultLanguage: string;
    settings: Record<string, string>;
  }> {
    const restaurant = await this.repo.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    const kv = await this.repo.listSettings(restaurantId);
    const settings: Record<string, string> = {};
    for (const row of kv) {
      if (row.value !== null) settings[row.key] = row.value;
    }
    return {
      currency: restaurant.currency,
      timezone: restaurant.timezone,
      defaultLanguage: restaurant.defaultLanguage,
      settings,
    };
  }

  async updateSettings(restaurantId: string, dto: UpdateSettingsDto): Promise<{
    currency: string;
    timezone: string;
    defaultLanguage: string;
    settings: Record<string, string>;
  }> {
    const update: Partial<typeof restaurants.$inferInsert> = {};
    if (dto.currency) update.currency = dto.currency;
    if (dto.timezone) update.timezone = dto.timezone;
    if (dto.defaultLanguage) update.defaultLanguage = dto.defaultLanguage;
    if (Object.keys(update).length > 0) {
      await this.repo.updateRestaurant(restaurantId, update);
    }
    if (dto.settings) {
      for (const [key, value] of Object.entries(dto.settings)) {
        await this.repo.upsertSetting(restaurantId, key, value);
      }
    }
    return this.getSettings(restaurantId);
  }
}
