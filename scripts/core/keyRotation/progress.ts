export type RotationAuditEvent =
  | "instance.key_rotation.started"
  | "instance.key_rotation.table_completed"
  | "instance.key_rotation.backup_reencrypted"
  | "instance.key_rotation.completed"
  | "instance.key_rotation.aborted"

export type RotationAuditRecord = {
  event: RotationAuditEvent
  createdAt: Date
  metadata: unknown
}

export type RotationProgress =
  | {
      ok: true
      operationId: string
      completedTables: Set<string>
    }
  | {
      ok: false
      reason: string
    }

export function resolveRotationProgress(records: readonly RotationAuditRecord[]): RotationProgress {
  const ordered = [...records].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  )
  const latestStarted = ordered.find((record) => record.event === "instance.key_rotation.started")

  if (!latestStarted) {
    return { ok: false, reason: "No key rotation audit trail was found." }
  }

  const operationId = readOperationId(latestStarted.metadata)

  if (!operationId) {
    return { ok: false, reason: "Latest key rotation audit trail is missing an operation id." }
  }

  const laterTerminalEvent = ordered.find(
    (record) =>
      record.createdAt > latestStarted.createdAt &&
      (record.event === "instance.key_rotation.completed" ||
        record.event === "instance.key_rotation.aborted") &&
      readOperationId(record.metadata) === operationId
  )

  if (laterTerminalEvent?.event === "instance.key_rotation.completed") {
    return { ok: false, reason: "Latest key rotation audit trail is already completed." }
  }

  const completedTables = new Set<string>()

  for (const record of ordered) {
    if (record.createdAt < latestStarted.createdAt) continue
    if (record.event !== "instance.key_rotation.table_completed") continue
    if (readOperationId(record.metadata) !== operationId) continue

    const table = readStringMetadata(record.metadata, "table")

    if (table) {
      completedTables.add(table)
    }
  }

  return { ok: true, operationId, completedTables }
}

function readOperationId(metadata: unknown): string | null {
  return readStringMetadata(metadata, "operationId")
}

function readStringMetadata(metadata: unknown, key: string): string | null {
  if (typeof metadata !== "object" || metadata === null || !(key in metadata)) return null

  const value = (metadata as Record<string, unknown>)[key]

  return typeof value === "string" && value.length > 0 ? value : null
}
