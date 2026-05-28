const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export type ParsedSemver = {
  major: number
  minor: number
  patch: number
  prerelease: string
}

export class InvalidSemverError extends Error {
  constructor(readonly value: string) {
    super(`Value ${value} is not a valid semantic version.`)
  }
}

export function parseSemver(value: string): ParsedSemver {
  const match = SEMVER.exec(value)

  if (!match) throw new InvalidSemverError(value)

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease: match[4] ?? ""
  }
}

export function compareSemver(left: string, right: string): number {
  const leftVersion = parseSemver(left)
  const rightVersion = parseSemver(right)

  for (const key of ["major", "minor", "patch"] as const) {
    const diff = leftVersion[key] - rightVersion[key]

    if (diff !== 0) return Math.sign(diff)
  }

  if (leftVersion.prerelease === rightVersion.prerelease) return 0
  if (!leftVersion.prerelease) return 1
  if (!rightVersion.prerelease) return -1

  return leftVersion.prerelease.localeCompare(rightVersion.prerelease)
}
