import { execFileSync } from "node:child_process"

import chalk from "chalk"

import { evaluateChangelogGate } from "./core/release/changelogGate"

const CHANGELOG_PATH = "CHANGELOG.md"

function checkChangelog(): void {
  const baseRef = process.argv[2] ?? process.env.CHANGELOG_BASE_REF

  if (!baseRef) {
    console.error(chalk.red("Usage: tsx ./scripts/check-changelog.ts <base-ref>"))
    process.exit(2)
  }

  // A two-dot diff against the commit the pull request targets, which is what the workflow hands
  // over as `pull_request.base.sha`. Three dots would need the merge base, and the runner checks
  // out a merge commit whose history does not always reach back to it.
  const changedPaths = git("diff", "--name-only", baseRef, "HEAD").split("\n").filter(Boolean)

  const result = evaluateChangelogGate({
    changedPaths,
    baseChangelog: readChangelogAt(baseRef),
    headChangelog: readChangelogAt("HEAD")
  })

  if (!result.required) {
    console.log(chalk.gray("No shipped behaviour changed; CHANGELOG.md not required."))

    return
  }

  if (result.satisfied) {
    console.log(chalk.green("CHANGELOG.md records this change under ## [Unreleased]."))

    return
  }

  console.error(
    chalk.red("CHANGELOG.md has no new entry under ## [Unreleased] for these changed files:")
  )
  for (const path of result.changedPaths) console.error(chalk.white(`  ${path}`))
  console.error(
    chalk.yellow(
      "\nAdd what changed for the people who use and run an instance, or label the pull request no-changelog."
    )
  )

  process.exit(1)
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
}

// Missing at the base commit means the file was added on this branch, which is a changelog that
// says everything rather than nothing.
function readChangelogAt(ref: string): string {
  try {
    return git("show", `${ref}:${CHANGELOG_PATH}`)
  } catch {
    return ""
  }
}

checkChangelog()
