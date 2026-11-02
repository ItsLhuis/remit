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
  "scripts/*.md",
  "openspec/*.md",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/rules/*.md",
  ".claude/rules/*.md"
]

// Every tracked file type whose comments can cite a document. JSON carries no comments, and the
// change specs under openspec/ plus this file's own planted paths are not citations.
const COMMENTED_PATHSPECS = [
  "*.ts",
  "*.tsx",
  "*.mjs",
  "*.yml",
  "*.yaml",
  "*.toml",
  "*.sh",
  "*.example",
  ":(exclude)openspec/*",
  ":(exclude)tests/docs/links.test.ts"
]

const HASH_COMMENT_FILE = /.(ya?ml|toml|sh|example)$/

// A Markdown path in a comment is rooted in a repository directory or names a root document.
const CITED_MARKDOWN =
  /(?<![\w./:@-])((?:[\w@[\]-]+\/)+[\w.-]+\.md|(?:README|AGENTS|CLAUDE|CHANGELOG|CONTRIBUTING)\.md)(?![\w-])/g

// Split so this file does not cite the gitignored path it skips.
const GITIGNORED_PROMPTS_PREFIX = ["docs", "prompts/"].join("/")

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
    .map((match) => match[1].trim().replace(/\s+"[^"]*"$/, ""))
    .filter((target) => target && !EXTERNAL_TARGET.test(target) && !/[\s<>]/.test(target))
    .map((target) => target.replace(/[#?].*$/, ""))
}

function commentText(source: string, hashComments: boolean): string[] {
  const leading = hashComments ? /^#/ : /^(\/\*|\*|\/\/)/
  const trailingStart = hashComments ? /(?<=\s)# / : /(?<!:)\/\/ /

  return source.split("\n").flatMap((line) => {
    const trimmed = line.trim()

    if (leading.test(trimmed)) return [trimmed]

    const trailing = line.search(trailingStart)

    return trailing === -1 ? [] : [line.slice(trailing)]
  })
}

function citedMarkdownPaths(source: string, hashComments = false): string[] {
  return commentText(source, hashComments).flatMap((line) =>
    [...line.matchAll(CITED_MARKDOWN)]
      .map((match) => match[1])
      .filter((path) => !path.startsWith(GITIGNORED_PROMPTS_PREFIX))
  )
}

function trackedCommentedFiles(): string[] {
  return execFileSync("git", ["ls-files", "--", ...COMMENTED_PATHSPECS], {
    cwd: repoRoot,
    encoding: "utf8"
  })
    .split("\n")
    .filter(Boolean)
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

  // The guidance test in agentFiles.test.ts already resolves the paths AGENTS.md and the rules cite,
  // so this one covers the comments in code and configuration files that point at a document.
  test("every Markdown file a comment cites exists", () => {
    const missing = trackedCommentedFiles().flatMap((file) =>
      citedMarkdownPaths(read(file), HASH_COMMENT_FILE.test(file))
        .filter((path) => !existsSync(join(repoRoot, path)))
        .map((path) => `${file} -> ${path}`)
    )

    expect(missing).toEqual([])
  })

  test("a comment citing a missing Markdown path is found", () => {
    const slashes = "/".repeat(2)
    const source = `const x = 1 ${slashes} see docs/operations/GONE.md and README.md\n${slashes} scripts/nope/README.md`

    expect(citedMarkdownPaths(source)).toEqual([
      "docs/operations/GONE.md",
      "README.md",
      "scripts/nope/README.md"
    ])
  })
})
