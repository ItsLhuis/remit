// @vitest-environment node

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

// The documents that describe `pnpm remit:seed-demo` to an operator. Listed rather than discovered,
// because the list is the guard: each one once called the seed "deterministic" without saying that
// its public tokens are not, which `scripts/core/seedDemo/plan.ts` mints at random on purpose.
const SEEDING_DOCUMENTS = [
  "AGENTS.md",
  "README.md",
  "docs/operations/INSTALL.md",
  "docs/architecture/ARCHITECTURE.md",
  "docs/architecture/operations/CLI-CONTRACT.md"
]

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8").replaceAll("\r\n", "\n")
}

test("no document calls demo seeding deterministic without its token exception", () => {
  const unqualified = SEEDING_DOCUMENTS.filter((path) =>
    /deterministic (?:demo|local\/demo)|seed deterministic/i.test(read(path).replaceAll("\n", " "))
  )

  expect(unqualified).toEqual([])
})
