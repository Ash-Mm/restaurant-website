import { Injectable, NotFoundException } from '@nestjs/common';
import { locations } from '@restaurant/db';
import { LocationRepository } from './location.repository.js';
import type { CreateLocationDto } from './dto/location.dto.js';
import type { UpdateLocationDto } from './dto/location.dto.js';

@Injectable()
export class LocationsService {
  constructor(private readonly repo: LocationRepository) {}

  async listLocations(restaurantId: string) {
    return this.repo.listByRestaurant(restaurantId);
  }

  async createLocation(restaurantId: string, dto: CreateLocationDto) {
    return this.repo.insert({
      restaurantId,
      name: dto.name,
      address: dto.address ?? null,
      active: dto.active ? 1 : 0,
      taxRegistrationNumber: dto.taxRegistrationNumber ?? null,
    });
  }

  async updateLocation(restaurantId: string, id: string, dto: UpdateLocationDto) {
    const belongs = await this.repo.belongsToRestaurant(id, restaurantId);
    if (!belongs) {
      throw new NotFoundException('Location not found');
    }
    const values: Partial<typeof locations.$inferInsert> = {};
    if (dto.name !== undefined) values.name = dto.name;
    if (dto.address !== undefined) values.address = dto.address ?? null;
    if (dto.active !== undefined) values.active = dto.active ? 1 : 0;
    if (dto.taxRegistrationNumber !== undefined) {
      values.taxRegistrationNumber = dto.taxRegistrationNumber ?? null;
    }
    await this.repo.update(id, values);
    return this.repo.findById(id);
  }
}
