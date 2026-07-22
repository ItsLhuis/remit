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

function findFilesMatching(pattern: RegExp): string[] {
  const files: string[] = []

  for (const root of SOURCE_ROOTS) {
    collectSourceFiles(join(repoRoot, root), files)
  }

  return files
    .filter((file) => pattern.test(readFileSync(file, "utf8")))
    .map((file) => relative(repoRoot, file).split("\\").join("/"))
}

test("exactly one file declares an html escape implementation", () => {
  const declarations = findFilesMatching(/function (escapeHtml|stripHtml)\b/)

  expect(declarations).toEqual([CANONICAL_ESCAPE_FILE])
})

test("exactly one file imports sanitize-html", () => {
  const importers = findFilesMatching(/from "sanitize-html"/)

  expect(importers).toEqual([CANONICAL_SANITIZER_FILE])
})
