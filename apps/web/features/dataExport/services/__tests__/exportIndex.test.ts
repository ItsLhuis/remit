import { describe, expect, test } from "vitest"

import { buildExportIndex, serializeExportIndex } from "../exportIndex"

const BASE_INPUT = {
  appVersion: "1.0.0",
  clientId: null,
  exportId: "11111111-1111-1111-1111-111111111111",
  files: [],
  generatedAt: new Date("2026-08-12T09:30:00.000Z"),
  scope: "instance" as const,
  tables: []
}

describe("buildExportIndex", () => {
  test("records the scope, the generation instant and the app version", () => {
    const index = buildExportIndex(BASE_INPUT)

    expect(index.formatVersion).toBe(1)
    expect(index.scope).toBe("instance")
    expect(index.appVersion).toBe("1.0.0")
    expect(index.generatedAt).toBe("2026-08-12T09:30:00.000Z")
  })

  test("names the exported client on a client-scoped export", () => {
    const index = buildExportIndex({
      ...BASE_INPUT,
      scope: "client",
      clientId: "22222222-2222-2222-2222-222222222222"
    })

    expect(index.clientId).toBe("22222222-2222-2222-2222-222222222222")
  })

  test("lists every excluded table with its reason", () => {
    const index = buildExportIndex(BASE_INPUT)

    expect(index.excluded.tables).toEqual(
      expect.arrayContaining([
        { table: "two_factors", reason: "authOwned" },
        { table: "proposal_otps", reason: "bearerToken" }
      ])
    )
  })

  test("lists the excluded secret columns of the scope it was built for", () => {
    const index = buildExportIndex(BASE_INPUT)

    expect(index.excluded.columns).toEqual(
      expect.arrayContaining([{ table: "settings", column: "smtpPass", reason: "secret" }])
    )
  })

  test("omits instance-only column exclusions from a client-scoped index", () => {
    const index = buildExportIndex({ ...BASE_INPUT, scope: "client", clientId: "client-1" })

    expect(index.excluded.columns.some((column) => column.table === "settings")).toBe(false)
  })

  test("carries the table and file summaries it was given", () => {
    const index = buildExportIndex({
      ...BASE_INPUT,
      tables: [{ table: "clients", file: "data/clients.json", rowCount: 3 }],
      files: [{ path: "files/logos/a.png", uploadId: "upload-1", sizeBytes: 42 }]
    })

    expect(index.tables).toEqual([{ table: "clients", file: "data/clients.json", rowCount: 3 }])
    expect(index.files).toEqual([
      { path: "files/logos/a.png", uploadId: "upload-1", sizeBytes: 42 }
    ])
  })
})

describe("serializeExportIndex", () => {
  test("writes newline-terminated JSON that parses back to the index", () => {
    const index = buildExportIndex(BASE_INPUT)

    const json = serializeExportIndex(index)

    expect(json.endsWith("\n")).toBe(true)
    expect(JSON.parse(json)).toEqual(index)
  })
})
