import { describe, expect, test } from "vitest"

import { parseReportQuery, scopeReportFilters, reportQuerySchema } from "../schemas"

describe("parseReportQuery", () => {
  test("falls back to the default report when the parameter is missing or unknown", () => {
    expect(parseReportQuery({}).report).toBe("revenueByClient")
    expect(parseReportQuery({ report: "nonsense" }).report).toBe("revenueByClient")
  })

  test("reads a calendar-day range as UTC midnight", () => {
    const query = parseReportQuery({
      report: "revenueByMonth",
      from: "2026-01-01",
      to: "2026-03-31"
    })

    expect(query.from?.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(query.to?.toISOString()).toBe("2026-03-31T00:00:00.000Z")
  })

  test("drops a malformed day rather than reporting on an invalid range", () => {
    expect(parseReportQuery({ from: "01/01/2026" }).from).toBeNull()
  })

  test("drops an entity id the selected report does not filter by", () => {
    const query = parseReportQuery({
      report: "taxSummary",
      client: "8d2b6c4e-1f3a-4a5b-9c7d-2e1f3a4b5c6d",
      taxRate: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
    })

    expect(query.clientId).toBeNull()
    expect(query.taxRateId).toBe("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d")
  })

  test("keeps both entity ids for a report that offers both", () => {
    const query = parseReportQuery({
      report: "revenueByProject",
      client: "8d2b6c4e-1f3a-4a5b-9c7d-2e1f3a4b5c6d",
      project: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
    })

    expect(query.clientId).toBe("8d2b6c4e-1f3a-4a5b-9c7d-2e1f3a4b5c6d")
    expect(query.projectId).toBe("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d")
  })

  test("drops an id that is not a uuid", () => {
    expect(parseReportQuery({ report: "revenueByClient", client: "../../etc" }).clientId).toBeNull()
  })
})

describe("scopeReportFilters", () => {
  test("re-scopes a query the export action did not build itself", () => {
    const parsed = reportQuerySchema.parse({
      report: "expensesByCategory",
      from: null,
      to: null,
      clientId: null,
      projectId: null,
      taxRateId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
    })

    expect(scopeReportFilters(parsed).taxRateId).toBeNull()
  })
})
