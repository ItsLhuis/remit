import { describe, expect, test } from "vitest"

import {
  getExportExcludedTables,
  getExportTableManifest,
  getExportTables,
  projectExportRow,
  serializeExportTable
} from "../exportManifest"

describe("getExportTables", () => {
  test("includes every business table in an instance export", () => {
    const tables = getExportTables("instance").map((manifest) => manifest.table)

    expect(tables).toEqual(
      expect.arrayContaining([
        "settings",
        "clients",
        "leads",
        "projects",
        "tasks",
        "time_entries",
        "expenses",
        "proposals",
        "contracts",
        "contract_signatures",
        "recurring_invoices",
        "invoices",
        "line_items",
        "payments",
        "credit_notes",
        "activity_logs",
        "email_logs",
        "templates",
        "tax_rates",
        "audit_logs",
        "uploads"
      ])
    )
  })

  test("omits the instance-wide tables from a client export", () => {
    const tables = getExportTables("client").map((manifest) => manifest.table)

    expect(tables).not.toContain("settings")
    expect(tables).not.toContain("templates")
    expect(tables).not.toContain("tax_rates")
    expect(tables).not.toContain("audit_logs")
  })

  test("keeps the client subgraph tables in a client export", () => {
    const tables = getExportTables("client").map((manifest) => manifest.table)

    expect(tables).toEqual(
      expect.arrayContaining([
        "clients",
        "projects",
        "invoices",
        "payments",
        "credit_notes",
        "time_entries",
        "expenses",
        "uploads"
      ])
    )
  })

  test("gives every exported table a distinct archive path", () => {
    const files = getExportTables("instance").map((manifest) => manifest.file)

    expect(new Set(files).size).toBe(files.length)
  })
})

describe("secret exclusion", () => {
  test("excludes every settings credential column", () => {
    const settings = getExportTableManifest("settings")

    expect(settings?.columns).toEqual(
      expect.not.arrayContaining([
        "smtpPass",
        "resendApiKey",
        "stripeSecretKey",
        "stripeWebhookSecret",
        "backupS3AccessKey",
        "backupS3SecretKey",
        "paymentIban"
      ])
    )
  })

  test("records a reason for every excluded settings column", () => {
    const settings = getExportTableManifest("settings")

    expect(settings?.excludedColumns.every((excluded) => excluded.reason.length > 0)).toBe(true)
  })

  test("excludes the public bearer token of every shareable document", () => {
    for (const table of ["invoices", "proposals", "contracts"]) {
      expect(getExportTableManifest(table)?.columns).not.toContain("publicToken")
    }
  })

  test("excludes the client portal bearer token", () => {
    expect(getExportTableManifest("clients")?.columns).not.toContain("portalToken")
  })

  test("keeps the owner's own client notes in the archive", () => {
    expect(getExportTableManifest("clients")?.columns).toContain("notes")
  })

  test("excludes the auth-owned and single-use-code tables entirely", () => {
    const excluded = getExportExcludedTables().map((table) => table.table)

    expect(excluded).toEqual(
      expect.arrayContaining([
        "users",
        "sessions",
        "accounts",
        "verifications",
        "two_factors",
        "organizations",
        "members",
        "invitations",
        "proposal_otps"
      ])
    )
  })

  test("never lists a table as both exported and excluded", () => {
    const exported = new Set(getExportTables("instance").map((manifest) => manifest.table))

    for (const excluded of getExportExcludedTables()) {
      expect(exported.has(excluded.table)).toBe(false)
    }
  })
})

describe("projectExportRow", () => {
  test("drops a column the manifest does not name", () => {
    const manifest = getExportTableManifest("clients")

    if (!manifest) throw new Error("clients manifest is missing")

    const projected = projectExportRow(manifest, {
      id: "client-1",
      name: "Acme",
      portalToken: "token-that-must-not-travel",
      notes: "Prefers email"
    })

    expect(projected).not.toHaveProperty("portalToken")
    expect(projected.name).toBe("Acme")
    expect(projected.notes).toBe("Prefers email")
  })

  test("emits null for a column missing from the row", () => {
    const manifest = getExportTableManifest("clients")

    if (!manifest) throw new Error("clients manifest is missing")

    expect(projectExportRow(manifest, { id: "client-1" }).city).toBeNull()
  })

  test("preserves falsy values that are not nullish", () => {
    const manifest = getExportTableManifest("invoices")

    if (!manifest) throw new Error("invoices manifest is missing")

    const projected = projectExportRow(manifest, { id: "invoice-1", viewCount: 0, notes: "" })

    expect(projected.viewCount).toBe(0)
    expect(projected.notes).toBe("")
  })
})

describe("serializeExportTable", () => {
  test("writes a newline-terminated JSON array of projected rows", () => {
    const manifest = getExportTableManifest("tax_rates")

    if (!manifest) throw new Error("tax_rates manifest is missing")

    const json = serializeExportTable(manifest, [
      { id: "rate-1", name: "VAT", percentage: "23.00", isDefault: true, secret: "nope" }
    ])

    expect(json.endsWith("\n")).toBe(true)
    expect(JSON.parse(json)).toEqual([
      {
        id: "rate-1",
        name: "VAT",
        percentage: "23.00",
        isDefault: true,
        deletedAt: null,
        createdAt: null,
        updatedAt: null
      }
    ])
  })

  test("writes an empty array for a table with no rows", () => {
    const manifest = getExportTableManifest("payments")

    if (!manifest) throw new Error("payments manifest is missing")

    expect(JSON.parse(serializeExportTable(manifest, []))).toEqual([])
  })
})
