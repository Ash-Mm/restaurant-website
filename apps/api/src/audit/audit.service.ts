import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository, type AuditEntry } from './audit.repository.js';

/**
 * Keys that must never reach the audit log (AGENTS.md: never log passwords,
 * tokens, or HMAC secrets). Metadata is scrubbed defensively at write time so
 * a careless call site cannot leak secrets.
 */
const FORBIDDEN_KEY = /pass(word)?|token|secret|hmac|authorization|cookie/i;

function sanitize(metadata: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    clean[key] = value;
  }
  return clean;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  /**
   * Best-effort audit write: a failed audit insert must never break the
   * calling flow, so errors are logged and swallowed.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.insert({
        ...entry,
        metadata: entry.metadata === undefined ? undefined : sanitize(entry.metadata),
      });
    } catch (err) {
      this.logger.error(
        `audit write failed for ${entry.action}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
