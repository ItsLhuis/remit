import { type ReleaseLinks } from "../types"

const GITHUB_REPOSITORY_URL = /^(?:git\+)?(https:\/\/github\.com\/[^/\s]+\/[^/\s]+?)(?:\.git)?$/

// Derived from package.json's `repository.url` so a fork links its own changelog. The links point at
// `main` rather than at the running version's tag: an operator opens them to learn what the
// releases after theirs changed, which a tag's copy of the file cannot contain.
export function getReleaseLinks(repositoryUrl: string): ReleaseLinks | null {
  const match = GITHUB_REPOSITORY_URL.exec(repositoryUrl)

  if (!match) return null

  const base = `${match[1]}/blob/main`

  return {
    changelogUrl: `${base}/CHANGELOG.md`,
    upgradeGuideUrl: `${base}/docs/operations/UPGRADE.md`
  }
}
