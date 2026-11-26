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
    expect(gate(["docs/operations/INSTALL.md", "README.md"])).toEqual({ required: false })
  })

  test("requires nothing when only tests and tooling changed", () => {
    const paths = [
      "apps/web/features/invoices/__tests__/mutations.integration.test.ts",
      "apps/web/tests/e2e/timeToInvoice.spec.ts",
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
    expect(gate(["apps/web/features/invoices/mutations.ts", "README.md"])).toEqual({
      required: true,
      satisfied: false,
      changedPaths: ["apps/web/features/invoices/mutations.ts"]
    })
  })

  test("accepts application code once an entry is added to the unreleased section", () => {
    expect(gate(["apps/web/features/invoices/mutations.ts"], withEntry)).toEqual({
      required: true,
      satisfied: true
    })
  })

  test("refuses a migration, an operator script and a compose change alike", () => {
    const paths = [
      "apps/web/drizzle/migrations/0011_new_column.sql",
      "scripts/host/upgrade.sh",
      "docker-compose.yml"
    ]

    expect(gate(paths)).toEqual({ required: true, satisfied: false, changedPaths: paths })
  })

  test("refuses a change to the Next.js configuration that adds no unreleased entry", () => {
    expect(gate(["apps/web/next.config.mjs"])).toEqual({
      required: true,
      satisfied: false,
      changedPaths: ["apps/web/next.config.mjs"]
    })
  })

  test("refuses a change to the worker package that adds no unreleased entry", () => {
    const paths = ["apps/worker/worker.ts", "apps/worker/core/crash.ts", "apps/worker/package.json"]

    expect(gate(paths)).toEqual({ required: true, satisfied: false, changedPaths: paths })
  })

  test("refuses a change to the core package that adds no unreleased entry", () => {
    const paths = ["packages/core/money.ts", "packages/core/package.json"]

    expect(gate(paths)).toEqual({ required: true, satisfied: false, changedPaths: paths })
  })

  test("does not accept the entries the base branch already carried", () => {
    const reordered = ["# Changelog", "", "## [Unreleased]", "", "- An older entry.", ""]

    expect(gate(["apps/web/lib/invoices/total.ts"], reordered)).toMatchObject({ satisfied: false })
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

    expect(gate(["apps/web/app/api/health/route.ts"], released)).toMatchObject({ satisfied: false })
  })
})
