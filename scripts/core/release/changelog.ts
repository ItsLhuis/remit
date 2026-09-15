export type ChangelogReleaseRefusal = "missingUnreleased" | "emptyUnreleased" | "versionExists"

export type ChangelogReleaseResult =
  | { ok: true; content: string }
  | { ok: false; reason: ChangelogReleaseRefusal }

const UNRELEASED_HEADING = "## [Unreleased]"

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

  const nextSectionIndex = lines.findIndex(
    (line, index) => index > unreleasedIndex && line.startsWith("## ")
  )
  const sectionEnd = nextSectionIndex === -1 ? lines.length : nextSectionIndex
  const hasEntry = lines
    .slice(unreleasedIndex + 1, sectionEnd)
    .some((line) => /^\s*[-*] \S/.test(line))

  if (!hasEntry) return { ok: false, reason: "emptyUnreleased" }

  const released = [
    ...lines.slice(0, unreleasedIndex),
    UNRELEASED_HEADING,
    "",
    `## [${version}] - ${date}`,
    ...lines.slice(unreleasedIndex + 1)
  ]

  return { ok: true, content: released.join("\n") }
}
