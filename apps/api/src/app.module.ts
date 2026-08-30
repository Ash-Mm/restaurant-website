import { Module, OnModuleInit } from '@nestjs/common';
import { getDb } from '@restaurant/db';
import { runMigrations } from '@restaurant/db/migrate';
import { HealthController } from './health/health.controller.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CustomersModule } from './customers/customers.module.js';

@Module({
  imports: [TenantsModule, LocationsModule, AuthModule, CustomersModule],
  controllers: [HealthController],
})
export class AppModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    const db = getDb();
    await runMigrations(db);
    // Fail fast if the database is unreachable on boot.
    await db.$client.execute('select 1');
  }
}
