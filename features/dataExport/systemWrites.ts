import { and, inArray, isNull, lte, or } from "drizzle-orm"

import { drainObjectDeletions, releaseObjects } from "@/lib/storage/objectDeletions"

import { database } from "@/database"
import { auditLogs, dataExports } from "@/database/schema"

import { getExportArtifactCutoff } from "./services"

type ExpiryTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0]

export type ExpiredExportArtifacts = {
  rows: number
  storageObjects: number
}

type ExpireArtifactsInput = {
  // Deletes the expired rows inside the transaction and returns the object key each one held.
  deleteExpired: (transaction: ExpiryTransaction) => Promise<Array<{ storageKey: string | null }>>
  audit: { event: string; targetEntityType: string }
}

// Removes every finished export older than `EXPORT_ARTIFACT_LIFETIME_DAYS`, and the archive behind
// it. Called by the nightly retention sweep (`features/trash/jobs.ts`). A request still assembling is
// left alone whatever its age, so a slow job never finishes into a row that is no longer there.
export async function expireDataExports(now: Date): Promise<ExpiredExportArtifacts> {
  const cutoff = getExportArtifactCutoff(now)

  return expireArtifacts({
    deleteExpired: (transaction) =>
      transaction
        .delete(dataExports)
        .where(
          and(
            inArray(dataExports.status, ["ready", "failed"]),
            or(
              lte(dataExports.completedAt, cutoff),
              and(isNull(dataExports.completedAt), lte(dataExports.createdAt, cutoff))
            )
          )
        )
        .returning({ storageKey: dataExports.storageKey }),
    audit: { event: "data_export.expired", targetEntityType: "data_export" }
  })
}

// The half every export artifact shares, data export or report PDF
// (`features/reports/systemWrites.ts`): the rows go, their objects are released in the same
// transaction with an audit entry that counts them, and the objects leave the bucket after the
// commit (ADR-0049).
export async function expireArtifacts({
  deleteExpired,
  audit
}: ExpireArtifactsInput): Promise<ExpiredExportArtifacts> {
  const outcome = await database.transaction(async (transaction) => {
    const expired = await deleteExpired(transaction)

    if (expired.length === 0) return { rows: 0, storageObjects: 0, deletionIds: [] }

    const release = await releaseObjects(transaction, {
      referencedBefore: [],
      objects: expired.flatMap(({ storageKey }) =>
        storageKey ? [{ bucket: "exports" as const, key: storageKey }] : []
      )
    })

    await transaction.insert(auditLogs).values({
      event: audit.event,
      targetEntityType: audit.targetEntityType,
      metadata: { expiredCount: expired.length, storageObjects: release.objects }
    })

    return {
      rows: expired.length,
      storageObjects: release.objects,
      deletionIds: release.deletionIds
    }
  })

  await drainObjectDeletions({ ids: outcome.deletionIds })

  return { rows: outcome.rows, storageObjects: outcome.storageObjects }
}
