import { Injectable } from '@nestjs/common';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { auditLogs, getDb, schema } from '@restaurant/db';

type Db = LibSQLDatabase<typeof schema>;

export interface AuditEntry {
  restaurantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditRepository {
  async insert(entry: AuditEntry, db: Db = getDb()): Promise<void> {
    await db.insert(auditLogs).values({
      restaurantId: entry.restaurantId,
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata === undefined ? null : JSON.stringify(entry.metadata),
    });
  }
}
