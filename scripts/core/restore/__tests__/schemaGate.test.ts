import { expect, test } from "vitest"

import { compareArchiveSchema, describeArchiveSchema } from "../schemaGate"

const JOURNAL = ["0000_initial_schema", "0001_insert_only_guards", "0002_document_parent_agreement"]

test("matches an archive taken at the migration this build ends on", () => {
  const comparison = compareArchiveSchema("0002_document_parent_agreement", JOURNAL)

  expect(comparison).toEqual({ kind: "same", migration: "0002_document_parent_agreement" })
})

test("calls an archive older when its migration is earlier in the journal", () => {
  const comparison = compareArchiveSchema("0000_initial_schema", JOURNAL)

  expect(comparison).toEqual({
    kind: "older",
    archiveMigration: "0000_initial_schema",
    currentMigration: "0002_document_parent_agreement"
  })
})

test("calls an archive of a database with no migration applied older", () => {
  expect(compareArchiveSchema("none", JOURNAL).kind).toBe("older")
})

test("calls an archive newer when the journal does not know its migration", () => {
  const comparison = compareArchiveSchema("0003_from_a_later_build", JOURNAL)

  expect(comparison).toEqual({
    kind: "newer",
    archiveMigration: "0003_from_a_later_build",
    currentMigration: "0002_document_parent_agreement"
  })
})

test("matches an unmigrated archive against a build with an empty journal", () => {
  expect(compareArchiveSchema("none", [])).toEqual({ kind: "same", migration: "none" })
})

test("describes each comparison with the migrations it names", () => {
  expect(describeArchiveSchema({ kind: "same", migration: "0002_x" })).toBe(
    "same as this build (0002_x)"
  )
  expect(
    describeArchiveSchema({ kind: "older", archiveMigration: "0000_a", currentMigration: "0002_x" })
  ).toContain("migrated forward to 0002_x")
  expect(
    describeArchiveSchema({ kind: "newer", archiveMigration: "0009_z", currentMigration: "0002_x" })
  ).toContain("a restore is refused")
})
