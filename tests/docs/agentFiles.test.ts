// @vitest-environment node

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

// The budgets come from measured evidence recorded when the method was designed: instruction
// adherence drops past ~100 directives, Anthropic recommends memory files under 200 lines and skill
// bodies under 500, Codex truncates AGENTS.md at 32 KiB, and the Claude skill listing truncates
// descriptions. Raising one is a deliberate edit here, never a side effect.
const ALWAYS_LOADED_MAX_BYTES = 20_000
const AGENTS_MD_MAX_LINES = 200
const AGENTS_MD_MAX_BYTES = 32 * 1024
const RULE_MAX_BYTES = 16_000
const RULE_POINTER_MAX_BYTES = 600
const SKILL_DESCRIPTION_MAX_CHARS = 400
const SKILL_BODY_MAX_LINES = 200
const AGENT_BODY_MAX_LINES = 120

// Split so this file does not cite the gitignored path it guards against.
const GITIGNORED_PROMPTS_PATH = ["docs", "prompts/"].join("/")

// Files allowed to name that path: the ignore file itself, and the comment rule that names it as an
// anti-pattern.
const PROMPTS_PATH_ALLOWED = [".gitignore", ".agents/rules/comments.md"]

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8").replaceAll("\r\n", "\n")
}

function listNames(path: string): string[] {
  return existsSync(join(repoRoot, path)) ? readdirSync(join(repoRoot, path)) : []
}

// A minimal reader for the two-level frontmatter these files use: `key: value`, or `key:` followed
// by indented continuation lines folded into one space-separated value.
function parseFrontmatter(text: string): { fields: Record<string, string>; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)

  if (!match) return { fields: {}, body: text }

  const fields: Record<string, string> = {}
  let currentKey = ""

  for (const line of match[1].split("\n")) {
    const keyMatch = line.match(/^([A-Za-z-]+):\s*(.*)$/)

    if (keyMatch) {
      currentKey = keyMatch[1]
      fields[currentKey] = keyMatch[2].trim()
    } else if (currentKey && line.startsWith(" ")) {
      fields[currentKey] = `${fields[currentKey]} ${line.trim()}`.trim()
    }
  }

  return { fields, body: text.slice(match[0].length) }
}

function guidanceFiles(): string[] {
  const markdownUnder = (directory: string): string[] =>
    listNames(directory).flatMap((name) => {
      const path = `${directory}/${name}`

      if (statSync(join(repoRoot, path)).isDirectory()) return markdownUnder(path)

      return path.endsWith(".md") ? [path] : []
    })

  return [
    "AGENTS.md",
    "CLAUDE.md",
    "openspec/README.md",
    ...markdownUnder(".agents"),
    ...markdownUnder(".claude/rules"),
    ...markdownUnder(".claude/skills"),
    ...markdownUnder(".claude/agents")
  ]
}

// Backticked tokens and relative markdown links that look like repository paths. Placeholders
// (`<name>`, globs, spaces) and command fragments are skipped; they are not paths.
function referencedPaths(markdown: string): string[] {
  const candidates = [
    ...[...markdown.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]),
    ...[...markdown.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((match) => match[1])
  ]

  return candidates.filter(
    (value) =>
      !/[<>*\s{}|$]/.test(value) &&
      !/^https?:/.test(value) &&
      !/\/[A-Z]\//.test(value) &&
      /^(\.agents|\.claude|\.codex|\.husky|openspec|tests|features|lib|app|components|hooks|docs|scripts|tools|database)\//.test(
        value
      ) &&
      /\.(md|ts|tsx|mjs|json|toml|rules)$|\/$/.test(value)
  )
}

describe("agent guidance stays within budget and consistent", () => {
  test("the always-loaded guidance stays within its byte budget", () => {
    const unscopedClaudeRules = listNames(".claude/rules")
      .map((name) => `.claude/rules/${name}`)
      .filter((path) => !read(path).startsWith("---\npaths:"))

    const bytes = ["CLAUDE.md", "AGENTS.md", ...unscopedClaudeRules].reduce(
      (total, path) => total + Buffer.byteLength(read(path)),
      0
    )

    expect(bytes).toBeLessThanOrEqual(ALWAYS_LOADED_MAX_BYTES)
  })

  test("AGENTS.md fits the line budget and Codex's default instruction limit", () => {
    const agents = read("AGENTS.md")

    expect(agents.split("\n").length).toBeLessThanOrEqual(AGENTS_MD_MAX_LINES)
    expect(Buffer.byteLength(agents)).toBeLessThanOrEqual(AGENTS_MD_MAX_BYTES)
  })

  test("rules and their pointers stay within their size budgets", () => {
    const oversized = [
      ...listNames(".agents/rules")
        .map((name) => `.agents/rules/${name}`)
        .filter((path) => Buffer.byteLength(read(path)) > RULE_MAX_BYTES),
      ...listNames(".claude/rules")
        .map((name) => `.claude/rules/${name}`)
        .filter((path) => Buffer.byteLength(read(path)) > RULE_POINTER_MAX_BYTES)
    ]

    expect(oversized).toEqual([])
  })

  test("every canonical skill has valid frontmatter and stays within budget", () => {
    const problems = listNames(".agents/skills").flatMap((name) => {
      const { fields, body } = parseFrontmatter(read(`.agents/skills/${name}/SKILL.md`))
      const description = fields.description ?? ""
      const found: string[] = []

      if (fields.name !== name) found.push(`${name}: name "${fields.name}" differs from its folder`)
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64)
        found.push(`${name}: bad name`)
      if (!description.startsWith("Use when"))
        found.push(`${name}: description must start "Use when"`)
      if (description.length > SKILL_DESCRIPTION_MAX_CHARS)
        found.push(`${name}: description too long`)
      if (body.split("\n").length > SKILL_BODY_MAX_LINES) found.push(`${name}: body too long`)

      return found
    })

    expect(problems).toEqual([])
  })

  test("every skill has an identical Claude wrapper and no wrapper lacks a canonical skill", () => {
    const canonical = listNames(".agents/skills")
    const wrappers = listNames(".claude/skills")

    const mismatched = canonical.filter((name) => {
      const wrapperPath = `.claude/skills/${name}/SKILL.md`

      if (!existsSync(join(repoRoot, wrapperPath))) return true

      const source = parseFrontmatter(read(`.agents/skills/${name}/SKILL.md`)).fields
      const wrapper = parseFrontmatter(read(wrapperPath))

      return (
        wrapper.fields.name !== source.name ||
        wrapper.fields.description !== source.description ||
        !wrapper.body.includes(`\`.agents/skills/${name}/SKILL.md\``)
      )
    })

    expect(mismatched).toEqual([])
    expect(wrappers.filter((name) => !canonical.includes(name))).toEqual([])
    expect(listNames(".claude/commands")).toEqual([])
  })

  test("every agent has Claude and Codex wrappers pointing at its canonical prompt", () => {
    const problems = listNames(".agents/agents").flatMap((file) => {
      const name = file.replace(/\.md$/, "")
      const pointer = `\`.agents/agents/${file}\``
      const claudePath = `.claude/agents/${file}`
      const codexPath = `.codex/agents/${name}.toml`
      const found: string[] = []

      if (read(`.agents/agents/${file}`).split("\n").length > AGENT_BODY_MAX_LINES) {
        found.push(`${name}: canonical prompt too long`)
      }

      if (!existsSync(join(repoRoot, claudePath)) || !read(claudePath).includes(pointer)) {
        found.push(`${name}: Claude wrapper missing or not pointing at ${file}`)
      }

      if (!existsSync(join(repoRoot, codexPath)) || !read(codexPath).includes(pointer)) {
        found.push(`${name}: Codex wrapper missing or not pointing at ${file}`)
      }

      return found
    })

    expect(problems).toEqual([])
  })

  test("every path a guidance file references exists", () => {
    const missing = guidanceFiles().flatMap((file) =>
      referencedPaths(read(file))
        .filter((path) => {
          const fromRoot = join(repoRoot, path)
          const fromFile = join(repoRoot, file, "..", path)

          return !existsSync(fromRoot) && !existsSync(fromFile)
        })
        .map((path) => `${file} -> ${path}`)
    )

    expect(missing).toEqual([])
  })

  // Claude Code matches the PowerShell tool only against PowerShell(...) rules, so a git deny that
  // exists for Bash alone leaves the same command open through the other shell.
  test("every Claude command deny exists for both Bash and PowerShell", () => {
    const settings = JSON.parse(read(".claude/settings.json")) as {
      permissions: { deny: string[] }
    }
    const deny = new Set(settings.permissions.deny)

    const unpaired = settings.permissions.deny
      .map((rule) => rule.match(/^(Bash|PowerShell)\((.*)\)$/))
      .filter((match) => match !== null)
      .filter(
        ([, tool, pattern]) => !deny.has(`${tool === "Bash" ? "PowerShell" : "Bash"}(${pattern})`)
      )
      .map(([rule]) => rule)

    expect(unpaired).toEqual([])
  })

  test("Claude and Codex both refuse the git operations reserved for the owner", () => {
    const claudeDeny = read(".claude/settings.json")
    const codexRules = read(".codex/rules/default.rules")

    const unguarded = ["push", "reset", "checkout", "rebase", "merge", "tag", "worktree"].filter(
      (subcommand) =>
        !claudeDeny.includes(`"Bash(git ${subcommand} *)"`) ||
        !new RegExp(
          `pattern = \\["git", (\\[[^\\]]*)?"${subcommand}"[\\s\\S]*?decision = "forbidden"`
        ).test(codexRules)
    )

    expect(unguarded).toEqual([])
  })

  test("no versioned file cites the gitignored prompt packs", () => {
    const citing = execFileSync("git", ["grep", "-l", "--fixed-strings", GITIGNORED_PROMPTS_PATH], {
      cwd: repoRoot,
      encoding: "utf8"
    })
      .split("\n")
      .filter((path) => path && !PROMPTS_PATH_ALLOWED.includes(path))

    expect(citing).toEqual([])
  })
})
