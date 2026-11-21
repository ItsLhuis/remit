import type postgres from "postgres"

import { RotationCliError } from "./errors"
import {
  readStringMetadata,
  resolveRotationProgress,
  type RotationAuditEvent,
  type RotationAuditRecord
} from "./progress"

type Sql = postgres.Sql

export async function loadRotationProgress(client: Sql) {
  const rows = await client<
    Array<{ created_at: Date | string; event: RotationAuditEvent; metadata: unknown }>
  >`
    SELECT event, metadata, created_at
    FROM audit_logs
    WHERE event LIKE 'instance.key_rotation.%'
    ORDER BY created_at ASC
  `
  const records: RotationAuditRecord[] = rows.map((row) => ({
    event: row.event,
    createdAt: readAuditCreatedAt(row.created_at),
    metadata: row.metadata
  }))

  return resolveRotationProgress(records)
}

function readAuditCreatedAt(value: Date | string): Date {
  const createdAt = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(createdAt.getTime())) {
    throw new RotationCliError("Key rotation audit trail contains an invalid created_at timestamp.")
  }

  return createdAt
}

export async function readStartedBackupPath(client: Sql, operationId: string): Promise<string> {
  const [row] = await client<Array<{ metadata: unknown }>>`
    SELECT metadata
    FROM audit_logs
    WHERE event = 'instance.key_rotation.started'
    ORDER BY created_at DESC
    LIMIT 1
  `
  const metadata = row?.metadata

  if (!metadataMatchesOperation(metadata, operationId)) {
    throw new RotationCliError(
      "Refusing resume: latest key rotation start marker does not match the resume operation."
    )
  }

  const backupPath = readStringMetadata(metadata, "backupPath")

  if (!backupPath) {
    throw new RotationCliError(
      "Refusing resume: key rotation audit trail is missing the pre-rotation backup path."
    )
  }

  return backupPath
}

function metadataMatchesOperation(metadata: unknown, operationId: string): boolean {
  return readStringMetadata(metadata, "operationId") === operationId
}
