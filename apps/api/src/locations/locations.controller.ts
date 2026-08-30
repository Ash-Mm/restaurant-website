import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { TenantGuard } from '../auth/tenant.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { RestaurantId } from '../auth/restaurant.decorator.js';
import { LocationsService } from './locations.service.js';
import { createLocationSchema, updateLocationSchema } from './dto/location.dto.js';
import type { CreateLocationDto } from './dto/location.dto.js';
import type { UpdateLocationDto } from './dto/location.dto.js';

@Controller('admin/locations')
@UseGuards(TenantGuard, JwtAuthGuard, PermissionsGuard)
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Get()
  @RequirePermissions('locations:read')
  list(@RestaurantId() restaurantId: string) {
    return this.service.listLocations(restaurantId);
  }

  @Post()
  @RequirePermissions('locations:write')
  @HttpCode(201)
  create(
    @RestaurantId() restaurantId: string,
    @Body(new ZodValidationPipe(createLocationSchema)) dto: CreateLocationDto
  ) {
    return this.service.createLocation(restaurantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('locations:write')
  update(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLocationSchema)) dto: UpdateLocationDto
  ) {
    return this.service.updateLocation(restaurantId, id, dto);
  }
}
