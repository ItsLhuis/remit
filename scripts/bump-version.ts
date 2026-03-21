import fs from "fs"
import path from "path"

import { fileURLToPath } from "url"

import chalk from "chalk"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type VersionType = "patch" | "minor" | "major"

function incrementVersion(version: string, type: VersionType): string {
  const [major, minor, patch] = version.split(".").map(Number)

  switch (type) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
  }
}

function bumpVersion() {
  const versionType = process.argv[2] as VersionType

  if (!versionType || !["patch", "minor", "major"].includes(versionType)) {
    console.error(chalk.red("Usage: tsx ./scripts/bump-version.ts <patch|minor|major>"))
    process.exit(1)
  }

  const projectRoot = path.resolve(__dirname, "..")
  const packageJsonPath = path.join(projectRoot, "package.json")

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as Record<
      string,
      unknown
    >

    const currentVersion = packageJson.version as string
    const newVersion = incrementVersion(currentVersion, versionType)
    const tag = `v${newVersion}`

    console.log(chalk.blue(`Bumping remit: ${currentVersion} → ${newVersion} (${versionType})\n`))

    packageJson.version = newVersion
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
    console.log(chalk.gray(`Updated package.json`))

    console.log(chalk.green(`\nVersion bumped to ${newVersion}`))
    console.log(chalk.yellow("\nNext steps:"))
    console.log(chalk.white(`  git add package.json`))
    console.log(chalk.white(`  git commit -m "chore: bump version to ${newVersion}"`))
    console.log(chalk.white(`  git tag ${tag}`))
    console.log(chalk.white(`  git push && git push origin ${tag}`))
  } catch (error) {
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`))
    process.exit(1)
  }
}

bumpVersion()
