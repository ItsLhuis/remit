export type ChangelogReleaseRefusal = "missingUnreleased" | "emptyUnreleased" | "versionExists"

export type ChangelogReleaseResult =
  | { ok: true; content: string }
  | { ok: false; reason: ChangelogReleaseRefusal }

const UNRELEASED_HEADING = "## [Unreleased]"

// The list entries under `## [Unreleased]`, in order, ignoring the `### Added` style subheadings
// and the blank lines between them. Both the release command and the pull-request gate read the
// section through this, so "the changelog says something" means the same thing in both.
export function unreleasedEntries(content: string): string[] {
  const lines = content.split(/\r?\n/)
  const unreleasedIndex = lines.indexOf(UNRELEASED_HEADING)

  if (unreleasedIndex === -1) return []

  const nextSectionIndex = lines.findIndex(
    (line, index) => index > unreleasedIndex && line.startsWith("## ")
  )
  const sectionEnd = nextSectionIndex === -1 ? lines.length : nextSectionIndex

  return lines
    .slice(unreleasedIndex + 1, sectionEnd)
    .filter((line) => /^\s*[-*] \S/.test(line))
    .map((line) => line.trim())
}

// Turns the Unreleased section of CHANGELOG.md into the dated section for `version` and leaves an
// empty Unreleased heading above it. An Unreleased section with no list entry is refused rather than
// released as an empty version: the version bump is the release act, and a dated section that says
// nothing tells an operator that nothing changed when that is almost never true.
export function releaseChangelog(
  content: string,
  version: string,
  date: string
): ChangelogReleaseResult {
  const lines = content.split(/\r?\n/)
  const unreleasedIndex = lines.indexOf(UNRELEASED_HEADING)

  if (unreleasedIndex === -1) return { ok: false, reason: "missingUnreleased" }
  if (lines.some((line) => line.startsWith(`## [${version}]`))) {
    return { ok: false, reason: "versionExists" }
  }

  if (unreleasedEntries(content).length === 0) return { ok: false, reason: "emptyUnreleased" }

  const released = [
    ...lines.slice(0, unreleasedIndex),
    UNRELEASED_HEADING,
    "",
    `## [${version}] - ${date}`,
    ...lines.slice(unreleasedIndex + 1)
  ]

  return { ok: true, content: released.join("\n") }
}
