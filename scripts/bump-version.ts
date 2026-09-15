import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import chalk from "chalk"

import { releaseChangelog, type ChangelogReleaseRefusal } from "./core/release/changelog"
import { incrementSemver, type SemverIncrement } from "./core/utils/semver"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const refusalMessages = {
  missingUnreleased: "CHANGELOG.md has no ## [Unreleased] heading.",
  emptyUnreleased:
    "CHANGELOG.md has no entries under ## [Unreleased]. Record what this release changes before bumping.",
  versionExists: "CHANGELOG.md already has a section for this version."
} satisfies Record<ChangelogReleaseRefusal, string>

function isSemverIncrement(value: string | undefined): value is SemverIncrement {
  return value === "patch" || value === "minor" || value === "major"
}

function bumpVersion() {
  const increment = process.argv[2]

  if (!isSemverIncrement(increment)) {
    console.error(chalk.red("Usage: tsx ./scripts/bump-version.ts <patch|minor|major>"))
    process.exit(1)
  }

  const projectRoot = path.resolve(__dirname, "..")
  const packageJsonPath = path.join(projectRoot, "package.json")
  const changelogPath = path.join(projectRoot, "CHANGELOG.md")

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as Record<
      string,
      unknown
    >

    const currentVersion = String(packageJson.version)
    const newVersion = incrementSemver(currentVersion, increment)
    const tag = `v${newVersion}`
    // The UTC calendar day, so the stamped date does not depend on the releasing machine's zone.
    const releaseDate = new Date().toISOString().slice(0, 10)

    // Both files are computed before either is written, so a refused release leaves the version and
    // the changelog exactly as they were rather than half bumped.
    const changelog = releaseChangelog(
      fs.readFileSync(changelogPath, "utf-8"),
      newVersion,
      releaseDate
    )

    if (!changelog.ok) {
      console.error(chalk.red(refusalMessages[changelog.reason]))
      process.exit(1)
    }

    console.log(chalk.blue(`Bumping remit: ${currentVersion} → ${newVersion} (${increment})\n`))

    fs.writeFileSync(changelogPath, changelog.content)
    console.log(chalk.gray(`Released CHANGELOG.md section ${newVersion} (${releaseDate})`))

    packageJson.version = newVersion
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
    console.log(chalk.gray(`Updated package.json`))

    console.log(chalk.green(`\nVersion bumped to ${newVersion}`))
    console.log(chalk.yellow("\nNext steps:"))
    console.log(chalk.white(`  git add package.json CHANGELOG.md`))
    console.log(chalk.white(`  git commit -m "chore: bump version to ${newVersion}"`))
    console.log(chalk.white(`  git tag ${tag}`))
    console.log(chalk.white(`  git push && git push origin ${tag}`))
  } catch (error) {
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`))
    process.exit(1)
  }
}

bumpVersion()
