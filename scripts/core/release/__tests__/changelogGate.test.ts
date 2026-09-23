import { describe, expect, test } from "vitest"

import { evaluateChangelogGate } from "../changelogGate"

const base = ["# Changelog", "", "## [Unreleased]", "", "### Fixed", "", "- An older entry.", ""]

const withEntry = [...base.slice(0, 7), "- A new entry.", ""]

function gate(changedPaths: string[], headChangelog: string[] = base) {
  return evaluateChangelogGate({
    changedPaths,
    baseChangelog: base.join("\n"),
    headChangelog: headChangelog.join("\n")
  })
}

describe("evaluateChangelogGate", () => {
  test("requires nothing when only documentation changed", () => {
    expect(gate(["docs/delivery/0053-test-suite.md", "README.md"])).toEqual({ required: false })
  })

  test("requires nothing when only tests and tooling changed", () => {
    const paths = [
      "features/invoices/__tests__/mutations.integration.test.ts",
      "tests/e2e/timeToInvoice.spec.ts",
      "tools/eslint-rules/index.mjs",
      "scripts/host/__tests__/install.test.ts",
      ".github/workflows/ci.yml"
    ]

    expect(gate(paths)).toEqual({ required: false })
  })

  test("requires nothing when only the repository's own release tooling changed", () => {
    const paths = [
      "scripts/bump-version.ts",
      "scripts/check-changelog.ts",
      "scripts/core/release/changelogGate.ts"
    ]

    expect(gate(paths)).toEqual({ required: false })
  })

  test("refuses application code that adds no unreleased entry", () => {
    expect(gate(["features/invoices/mutations.ts", "README.md"])).toEqual({
      required: true,
      satisfied: false,
      changedPaths: ["features/invoices/mutations.ts"]
    })
  })

  test("accepts application code once an entry is added to the unreleased section", () => {
    expect(gate(["features/invoices/mutations.ts"], withEntry)).toEqual({
      required: true,
      satisfied: true
    })
  })

  test("refuses a migration, an operator script and a compose change alike", () => {
    const paths = [
      "drizzle/migrations/0011_new_column.sql",
      "scripts/host/upgrade.sh",
      "docker-compose.yml"
    ]

    expect(gate(paths)).toEqual({ required: true, satisfied: false, changedPaths: paths })
  })

  test("does not accept the entries the base branch already carried", () => {
    const reordered = ["# Changelog", "", "## [Unreleased]", "", "- An older entry.", ""]

    expect(gate(["lib/invoices/total.ts"], reordered)).toMatchObject({ satisfied: false })
  })

  test("ignores entries that belong to an already released section", () => {
    const released = [
      ...base,
      "## [1.0.0] - 2026-01-01",
      "",
      "### Added",
      "",
      "- A released entry.",
      ""
    ]

    expect(gate(["app/api/health/route.ts"], released)).toMatchObject({ satisfied: false })
  })
})
