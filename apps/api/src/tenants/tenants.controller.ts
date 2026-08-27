import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { TenantsService } from './tenants.service.js';
import { createTenantSchema, type CreateTenantDto } from './dto/create-tenant.dto.js';

@Controller('admin/tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Post()
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(createTenantSchema)) dto: CreateTenantDto) {
    return this.service.createTenant(dto);
  }
}
