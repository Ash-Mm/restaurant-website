import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { TenantGuard } from '../auth/tenant.guard.js';
import { RestaurantId } from '../auth/restaurant.decorator.js';
import { TenantsService } from './tenants.service.js';
import { updateSettingsSchema, type UpdateSettingsDto } from './dto/settings.dto.js';
import { brandingSchema, type BrandingDto } from './dto/branding.dto.js';

@Controller('admin/settings')
@UseGuards(TenantGuard)
export class SettingsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  get(@RestaurantId() restaurantId: string) {
    return this.service.getSettings(restaurantId);
  }

  @Put()
  update(
    @RestaurantId() restaurantId: string,
    @Body(new ZodValidationPipe(updateSettingsSchema)) dto: UpdateSettingsDto
  ) {
    return this.service.updateSettings(restaurantId, dto);
  }

  @Patch('branding')
  updateBranding(
    @RestaurantId() restaurantId: string,
    @Body(new ZodValidationPipe(brandingSchema)) dto: BrandingDto
  ) {
    return this.service.updateBranding(restaurantId, dto);
  }
}
