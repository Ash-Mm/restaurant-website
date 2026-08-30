import { Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AuditRepository } from './audit.repository.js';

@Module({
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
