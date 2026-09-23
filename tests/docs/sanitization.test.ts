// @vitest-environment node

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

// Guards the sanitization consolidation: exactly one canonical HTML-escape implementation
// (lib/utils/html.ts) and one sanitize-html wrapper (the templates sanitizeHtml service) exist
// repo-wide.

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

const SOURCE_ROOTS = ["app", "components", "features", "hooks", "lib", "providers"]

const CANONICAL_ESCAPE_FILE = "lib/utils/html.ts"
const CANONICAL_SANITIZER_FILE = "features/templates/services/sanitizeHtml.ts"

function collectSourceFiles(directory: string, files: string[]): void {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry)

    if (statSync(absolutePath).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue

      collectSourceFiles(absolutePath, files)
      continue
    }

    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(absolutePath)
  }
}

// Walked and read once for the whole file: both tests scan the same few thousand source files, and
// doing it per test put each one within a second of the suite's budget under a full parallel run.
const sources = SOURCE_ROOTS.flatMap((root) => {
  const files: string[] = []

  collectSourceFiles(join(repoRoot, root), files)

  return files.map((file) => ({
    path: relative(repoRoot, file).split("\\").join("/"),
    content: readFileSync(file, "utf8")
  }))
})

function findFilesMatching(pattern: RegExp): string[] {
  return sources.filter((source) => pattern.test(source.content)).map((source) => source.path)
}

test("exactly one file declares an html escape implementation", () => {
  const declarations = findFilesMatching(/function (escapeHtml|stripHtml)\b/)

  expect(declarations).toEqual([CANONICAL_ESCAPE_FILE])
})

test("exactly one file imports sanitize-html", () => {
  const importers = findFilesMatching(/from "sanitize-html"/)

  expect(importers).toEqual([CANONICAL_SANITIZER_FILE])
})
