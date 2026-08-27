import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantRepository } from './tenant.repository.js';
import type { AppRequest } from './request.types.js';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenants: TenantRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const slug = req.headers['x-restaurant-slug'];
    if (typeof slug !== 'string' || slug.length === 0) {
      throw new UnauthorizedException('Missing X-Restaurant-Slug');
    }
    const restaurant = await this.tenants.findBySlug(slug);
    if (!restaurant) {
      throw new UnauthorizedException('Unknown restaurant');
    }
    req.restaurantId = restaurant.id;
    return true;
  }
}
