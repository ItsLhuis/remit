import { and, inArray, isNull, lte, or } from "drizzle-orm"

import { reportExports } from "@/database/schema"

import { getExportArtifactCutoff } from "@/features/dataExport/services"
import { expireArtifacts, type ExpiredExportArtifacts } from "@/features/dataExport/systemWrites"

// The report half of export expiry, on the lifetime `features/dataExport/services/artifactExpiry.ts`
// sets for every export artifact. Called by the nightly retention sweep (`features/trash/jobs.ts`);
// a render still in flight is left alone whatever its age.
export async function expireReportExports(now: Date): Promise<ExpiredExportArtifacts> {
  const cutoff = getExportArtifactCutoff(now)

  return expireArtifacts({
    deleteExpired: (transaction) =>
      transaction
        .delete(reportExports)
        .where(
          and(
            inArray(reportExports.status, ["ready", "failed"]),
            or(
              lte(reportExports.completedAt, cutoff),
              and(isNull(reportExports.completedAt), lte(reportExports.createdAt, cutoff))
            )
          )
        )
        .returning({ storageKey: reportExports.storageKey }),
    audit: { event: "report.pdf_export.expired", targetEntityType: "report_export" }
  })
}
