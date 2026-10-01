// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

// Written out rather than read from one of the files below, so a change to any of them — a moved
// digest, a tag put back — has to be made here too, deliberately (ADR-0045: moving the store's pin
// repeats its evaluation).
const STORE_IMAGE =
  "ghcr.io/rustfs/rustfs:1.0.0@sha256:8cc9801755448b71a786705ce76692c77e14936cccd87cf2fc31842e58f4d1ff"

function listFiles(directory: string): string[] {
  return readdirSync(join(repoRoot, directory))
    .filter((name) => name.endsWith(".yml"))
    .map((name) => join(directory, name))
}

const DEPLOYMENT_FILES = [
  "docker-compose.yml",
  "docker-compose.dev.yml",
  "docker-compose.test.yml",
  "docker-compose.ci.yml",
  ...listFiles(".github/workflows")
]

function findReferences(pattern: RegExp): Array<{ file: string; reference: string }> {
  return DEPLOYMENT_FILES.flatMap((file) =>
    [...readFileSync(join(repoRoot, file), "utf8").matchAll(pattern)].map((match) => ({
      file,
      reference: match[0].replace(/["']/g, "")
    }))
  )
}

test("every reference to the bundled store's image is the one pinned release and digest", () => {
  const references = findReferences(/[\w./-]*rustfs\/rustfs[\w.:@-]*/g)

  expect(references.map((entry) => entry.file)).toEqual(
    expect.arrayContaining([
      "docker-compose.yml",
      "docker-compose.dev.yml",
      "docker-compose.test.yml",
      join(".github/workflows", "docker.yml")
    ])
  )
  expect(references.filter((entry) => entry.reference !== STORE_IMAGE)).toEqual([])
})
