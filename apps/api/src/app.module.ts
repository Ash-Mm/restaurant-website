import { Module, OnModuleInit } from '@nestjs/common';
import { getDb } from '@restaurant/db';
import { HealthController } from './health/health.controller.js';

@Module({
  controllers: [HealthController],
})
export class AppModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    // Fail fast if the database is unreachable on boot.
    await getDb().$client.execute('select 1');
  }
}
