import type postgres from "postgres"

import { type RotationAuditEvent } from "./progress"

type Sql = postgres.Sql

const CLI_USER_AGENT = "cli/rotate-encryption-key"

export async function writeRotationAudit(
  client: Sql,
  event: RotationAuditEvent,
  metadata: Record<string, unknown>
): Promise<void> {
  await client`
    INSERT INTO audit_logs (
      event,
      actor_user_id,
      actor_role,
      target_entity_type,
      target_entity_id,
      metadata,
      ip_address,
      user_agent
    ) VALUES (
      ${event},
      NULL,
      NULL,
      'instance',
      NULL,
      ${JSON.stringify(metadata)}::jsonb,
      NULL,
      ${CLI_USER_AGENT}
    )
  `
}
