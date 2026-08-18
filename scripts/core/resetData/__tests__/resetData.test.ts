import { expect, test } from "vitest"

import { parseResetDataArgs } from "../args"

test("defaults to an interactive, writing run when no flags are given", () => {
  const parsed = parseResetDataArgs([])

  expect(parsed).toEqual({ data: { dryRun: false, help: false, yes: false } })
})

test("parses every supported flag in any order", () => {
  const parsed = parseResetDataArgs(["--yes", "--help", "--dry-run"])

  expect(parsed).toEqual({ data: { dryRun: true, help: true, yes: true } })
})

test("returns an error naming the flag when an unknown option is passed", () => {
  const parsed = parseResetDataArgs(["--force"])

  expect(parsed).toEqual({ error: "Unknown option: --force" })
})

test("rejects seed flags that do not apply to a reset", () => {
  const parsed = parseResetDataArgs(["--reseed"])

  expect(parsed).toEqual({ error: "Unknown option: --reseed" })
})
