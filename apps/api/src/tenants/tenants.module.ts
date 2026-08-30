import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TenantRepository } from '../auth/tenant.repository.js';
import { TenantGuard } from '../auth/tenant.guard.js';
import { LocationGuard } from '../auth/location.guard.js';
import { TenantsService } from './tenants.service.js';
import { TenantsController } from './tenants.controller.js';
import { SettingsController } from './settings.controller.js';
import { PublicController } from './public.controller.js';
import { UploadController } from './upload.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [TenantsController, SettingsController, PublicController, UploadController],
  providers: [TenantsService, TenantRepository, TenantGuard, LocationGuard],
})
export class TenantsModule {}
