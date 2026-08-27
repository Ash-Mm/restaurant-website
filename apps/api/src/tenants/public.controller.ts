import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service.js';

@Controller('public')
export class PublicController {
  constructor(private readonly tenants: TenantsService) {}

  @Get(':slug/menu')
  async menu(@Param('slug') slug: string) {
    const profile = await this.tenants.getPublicProfile(slug);
    if (!profile) {
      throw new NotFoundException('Restaurant not found');
    }
    return profile;
  }
}
