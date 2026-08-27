import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantRepository } from './tenant.repository.js';
import type { AppRequest } from './request.types.js';

@Injectable()
export class LocationGuard implements CanActivate {
  constructor(private readonly tenants: TenantRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const restaurantId = req.restaurantId;
    if (!restaurantId) {
      throw new UnauthorizedException('Restaurant context required');
    }
    const locationId = req.headers['x-location-id'];
    if (typeof locationId !== 'string' || locationId.length === 0) {
      throw new UnauthorizedException('Missing X-Location-Id');
    }
    const ok = await this.tenants.verifyLocation(locationId, restaurantId);
    if (!ok) {
      throw new UnauthorizedException('Location does not belong to restaurant');
    }
    req.locationId = locationId;
    return true;
  }
}
