import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { TenantGuard } from '../auth/tenant.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { RestaurantId } from '../auth/restaurant.decorator.js';
import { TenantsService } from './tenants.service.js';
import { updateSettingsSchema, type UpdateSettingsDto } from './dto/settings.dto.js';
import { brandingSchema, type BrandingDto } from './dto/branding.dto.js';

@Controller('admin/settings')
@UseGuards(TenantGuard, JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  @RequirePermissions('settings:read')
  get(@RestaurantId() restaurantId: string) {
    return this.service.getSettings(restaurantId);
  }

  @Patch()
  @RequirePermissions('settings:write')
  update(
    @RestaurantId() restaurantId: string,
    @Body(new ZodValidationPipe(updateSettingsSchema)) dto: UpdateSettingsDto
  ) {
    return this.service.updateSettings(restaurantId, dto);
  }

  @Patch('branding')
  @RequirePermissions('settings:write')
  updateBranding(
    @RestaurantId() restaurantId: string,
    @Body(new ZodValidationPipe(brandingSchema)) dto: BrandingDto
  ) {
    return this.service.updateBranding(restaurantId, dto);
  }
}
