import { describe, expect, test } from "vitest"

import { computeExportProgress } from "../exportProgress"

describe("computeExportProgress", () => {
  test("reports nothing done before the first table is written", () => {
    expect(
      computeExportProgress({ tablesDone: 0, tablesTotal: 20, filesDone: 0, filesTotal: 5 })
    ).toBe(0)
  })

  test("caps the table phase below the file phase", () => {
    expect(
      computeExportProgress({ tablesDone: 20, tablesTotal: 20, filesDone: 0, filesTotal: 5 })
    ).toBe(20)
  })

  test("reaches 100 once tables and files are both written", () => {
    expect(
      computeExportProgress({ tablesDone: 20, tablesTotal: 20, filesDone: 5, filesTotal: 5 })
    ).toBe(100)
  })

  test("reaches 100 on an instance with no uploads at all", () => {
    expect(
      computeExportProgress({ tablesDone: 20, tablesTotal: 20, filesDone: 0, filesTotal: 0 })
    ).toBe(100)
  })

  test("floors a partial file phase rather than rounding it up", () => {
    expect(
      computeExportProgress({ tablesDone: 20, tablesTotal: 20, filesDone: 2, filesTotal: 3 })
    ).toBe(73)
  })

  test("never exceeds 100 when a counter overruns its total", () => {
    expect(
      computeExportProgress({ tablesDone: 30, tablesTotal: 20, filesDone: 9, filesTotal: 5 })
    ).toBe(100)
  })

  test("never falls below 0", () => {
    expect(
      computeExportProgress({ tablesDone: -5, tablesTotal: 20, filesDone: 0, filesTotal: 5 })
    ).toBe(0)
  })
})
