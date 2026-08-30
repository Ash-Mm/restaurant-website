import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TenantRepository } from '../auth/tenant.repository.js';
import { TenantGuard } from '../auth/tenant.guard.js';
import { LocationGuard } from '../auth/location.guard.js';
import { LocationsService } from './locations.service.js';
import { LocationRepository } from './location.repository.js';
import { LocationsController } from './locations.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [LocationsController],
  providers: [LocationsService, LocationRepository, TenantRepository, TenantGuard, LocationGuard],
})
export class LocationsModule {}
