import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { CustomersRepository } from './customers.repository.js';
import { GuestsController } from './customers.controller.js';

@Module({
  controllers: [GuestsController],
  providers: [CustomersService, CustomersRepository],
  exports: [CustomersService],
})
export class CustomersModule {}
