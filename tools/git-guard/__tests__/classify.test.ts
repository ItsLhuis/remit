// @vitest-environment node

import { describe, expect, test } from "vitest"

import { classifyCommand } from "../classify.mjs"

const directories = new Set(["features", "features/clients", ".agents/rules"])

function isAllowed(command: string): boolean {
  return classifyCommand(command, (path: string) => directories.has(path.replace(/\/$/, "")))
    .allowed
}

describe("git guard", () => {
  test.each([
    "git status --porcelain",
    "git diff --cached --name-only",
    "git log --oneline -5",
    "git show --stat HEAD",
    "git add -- features/clients/queries.ts tests/docs/rules.test.ts",
    "git add AGENTS.md CLAUDE.md",
    'git commit -m "docs(rules): trim prose"',
    "git commit -F - <<'EOF'\ndocs(agents): add skills\n\nBody line.\nEOF",
    "git -C S:/Code/remit log -1",
    "git branch",
    "git branch --show-current",
    "pnpm lint && pnpm typecheck && git add -- AGENTS.md && git commit -m 'docs: x'",
    "echo pushing is for the owner"
  ])("allows %s", (command) => {
    expect(isAllowed(command)).toBe(true)
  })

  test.each([
    "git push",
    "git push origin main",
    "git -C . push origin main",
    "git -c push.default=current push",
    "/usr/bin/git push",
    "git.exe push",
    "pnpm lint && git push",
    "git status; git reset --hard HEAD",
    "bash -c 'git push origin main'",
    'pwsh -Command "git push"',
    "timeout 60 git push",
    "git checkout main",
    "git switch -c feature",
    "git restore --staged AGENTS.md",
    "git stash",
    "git merge other",
    "git rebase -i HEAD~3",
    "git cherry-pick abc123",
    "git tag before-change",
    "git worktree add ../tree",
    "git branch feature",
    "git branch -D old",
    "git add -A",
    "git add --all",
    "git add -u",
    "git add .",
    "git add ./",
    "git add :/",
    "git add '*.ts'",
    "git add features/clients",
    "git add -f docs/ignored.md",
    "git commit --amend --no-edit",
    "git commit -am 'x'",
    "git commit -nm 'x'",
    "git commit --no-verify -m x",
    "HUSKY=0 git commit -m x",
    "$env:HUSKY=0; git commit -m x",
    "git -c core.hooksPath=/dev/null commit -m x",
    "git config core.hooksPath .nohooks"
  ])("blocks %s", (command) => {
    expect(isAllowed(command)).toBe(false)
  })

  test("explains why a command was blocked", () => {
    const verdict = classifyCommand("git push origin main", () => false)

    expect(verdict).toEqual({ allowed: false, reason: "git push is reserved for the owner" })
  })
})
