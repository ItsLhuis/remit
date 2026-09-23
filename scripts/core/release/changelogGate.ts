import { unreleasedEntries } from "./changelog"

export type ChangelogGateResult =
  | { required: false }
  | { required: true; satisfied: true }
  | { required: true; satisfied: false; changedPaths: string[] }

// What an operator reading CHANGELOG.md is deciding about: whether to upgrade. A change under these
// paths reaches a running instance — application code, the database, the images, the proxy
// configuration, and the commands an operator runs by hand.
const SHIPPED_ROOTS = [
  "app/",
  "components/",
  "database/",
  "deploy/",
  "drizzle/",
  "features/",
  "hooks/",
  "lib/",
  "providers/",
  "public/",
  "scripts/"
]

const SHIPPED_FILES = [
  "Dockerfile",
  "docker-compose.yml",
  "docker-entrypoint.sh",
  "instrumentation.ts",
  "next.config.ts",
  "package.json",
  "proxy.ts"
]

// The release tooling that lives under `scripts/` beside the operator commands but runs only in this
// repository: the version bump and this gate. Neither is in `tsup.scripts.config.ts`, which is the
// list of scripts that reach an image.
const REPOSITORY_TOOLING = [
  "scripts/bump-version.ts",
  "scripts/check-changelog.ts",
  "scripts/core/release/"
]

type ChangelogGateInput = {
  changedPaths: string[]
  baseChangelog: string
  headChangelog: string
}

// A branch that changes what an instance does has to say so under `## [Unreleased]`, because the
// release command only ever promotes what is already written there: an entry missed here is a
// release note that never existed. Adding to the section is what counts, not having one — the
// section is rarely empty on `main`, so comparing against the base branch is the only way to tell a
// new entry from an inherited one.
export function evaluateChangelogGate(input: ChangelogGateInput): ChangelogGateResult {
  const changedPaths = input.changedPaths.filter(changesShippedBehaviour)

  if (changedPaths.length === 0) return { required: false }

  const baseEntries = new Set(unreleasedEntries(input.baseChangelog))
  const added = unreleasedEntries(input.headChangelog).filter((entry) => !baseEntries.has(entry))

  if (added.length === 0) return { required: true, satisfied: false, changedPaths }

  return { required: true, satisfied: true }
}

function changesShippedBehaviour(path: string): boolean {
  if (isExcluded(path)) return false

  return SHIPPED_ROOTS.some((root) => path.startsWith(root)) || SHIPPED_FILES.includes(path)
}

// Tests, fixtures and tooling ship in the repository, not to an instance. `scripts/host/__tests__`
// is the reason this is a suffix check rather than a root check: the operator-facing installer and
// its tests live under the same root.
function isExcluded(path: string): boolean {
  return (
    path.includes("/__tests__/") ||
    path.startsWith("tests/") ||
    path.startsWith("tools/") ||
    REPOSITORY_TOOLING.some((tool) => path.startsWith(tool)) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
  )
}
