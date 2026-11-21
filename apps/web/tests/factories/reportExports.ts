import { type InferInsertModel } from "drizzle-orm"

import { reportExports } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeReportExport(
  overrides?: Partial<InferInsertModel<typeof reportExports>>
) {
  const [reportExport] = await database
    .insert(reportExports)
    .values({
      report: "revenueByClient",
      filters: { from: null, to: null, clientId: null, projectId: null, taxRateId: null },
      status: "pending",
      ...overrides
    })
    .returning()

  if (!reportExport) throw new Error("makeReportExport: insert failed")

  return reportExport
}
