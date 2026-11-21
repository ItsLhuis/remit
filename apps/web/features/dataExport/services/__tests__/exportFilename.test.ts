import { describe, expect, test } from "vitest"

import { buildExportFilename, buildExportStorageKey } from "../exportFilename"

const REQUESTED_AT = new Date("2026-08-12T22:45:00.000Z")

describe("buildExportFilename", () => {
  test("names an instance export by its request day", () => {
    const filename = buildExportFilename({
      scope: "instance",
      clientName: null,
      requestedAt: REQUESTED_AT
    })

    expect(filename).toBe("remit-export-instance-2026-08-12.zip")
  })

  test("slugs the client name into a client export filename", () => {
    const filename = buildExportFilename({
      scope: "client",
      clientName: "Acme Corp GmbH",
      requestedAt: REQUESTED_AT
    })

    expect(filename).toBe("remit-export-acme-corp-gmbh-2026-08-12.zip")
  })

  test("strips diacritics rather than dropping the letter", () => {
    const filename = buildExportFilename({
      scope: "client",
      clientName: "Ação & Cia",
      requestedAt: REQUESTED_AT
    })

    expect(filename).toBe("remit-export-acao-cia-2026-08-12.zip")
  })

  test("falls back to the scope when the client name has no usable characters", () => {
    const filename = buildExportFilename({
      scope: "client",
      clientName: "***",
      requestedAt: REQUESTED_AT
    })

    expect(filename).toBe("remit-export-client-2026-08-12.zip")
  })

  test("falls back to the scope when the client has no name at all", () => {
    const filename = buildExportFilename({
      scope: "client",
      clientName: null,
      requestedAt: REQUESTED_AT
    })

    expect(filename).toBe("remit-export-client-2026-08-12.zip")
  })

  test("bounds the slug so a long client name cannot dominate the filename", () => {
    const filename = buildExportFilename({
      scope: "client",
      clientName: "A".repeat(120),
      requestedAt: REQUESTED_AT
    })

    expect(filename).toBe(`remit-export-${"a".repeat(48)}-2026-08-12.zip`)
  })
})

describe("buildExportStorageKey", () => {
  test("scopes the object key by export id", () => {
    expect(buildExportStorageKey("export-1", "remit-export-instance-2026-08-12.zip")).toBe(
      "exports/export-1/remit-export-instance-2026-08-12.zip"
    )
  })
})
