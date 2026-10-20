// @vitest-environment node

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

// Git pathspecs without glob magic let `*` cross directories, so `docs/*.md` covers every tracked
// Markdown file under docs/ while the gitignored prompt packs stay out.
const CHECKED_PATHSPECS = [
  "docs/*.md",
  "openspec/*.md",
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/rules/*.md",
  ".claude/rules/*.md"
]

const EXTERNAL_TARGET = /^(https?:|mailto:|#)/

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8").replaceAll("\r\n", "\n")
}

function checkedFiles(): string[] {
  return execFileSync("git", ["ls-files", "--", ...CHECKED_PATHSPECS], {
    cwd: repoRoot,
    encoding: "utf8"
  })
    .split("\n")
    .filter(Boolean)
}

// Fenced blocks and inline code hold examples and templates, not links a reader follows.
function proseOf(markdown: string): string {
  return markdown.replaceAll(/^ *(```|~~~)[\s\S]*?^ *\1/gm, "").replaceAll(/`[^`\n]*`/g, "")
}

function relativeTargets(markdown: string): string[] {
  return [...proseOf(markdown).matchAll(/!?\[[^\]]*\]\(([^)]*)\)/g)]
    .map((match) => match[1].trim())
    .filter((target) => target && !EXTERNAL_TARGET.test(target) && !/[\s<>]/.test(target))
    .map((target) => target.replace(/[#?].*$/, ""))
}

describe("documentation links", () => {
  test("every relative Markdown link resolves to an existing file or directory", () => {
    const broken = checkedFiles().flatMap((file) =>
      relativeTargets(read(file))
        .filter((target) => !existsSync(join(repoRoot, dirname(file), target)))
        .map((target) => `${file} -> ${target}`)
    )

    expect(broken).toEqual([])
  })
})
