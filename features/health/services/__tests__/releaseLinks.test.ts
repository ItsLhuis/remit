import { expect, test } from "vitest"

import { getReleaseLinks } from "../releaseLinks"

test("links the changelog and upgrade runbook on main when the repository is on GitHub", () => {
  const links = getReleaseLinks("git+https://github.com/ItsLhuis/remit.git")

  expect(links).toEqual({
    changelogUrl: "https://github.com/ItsLhuis/remit/blob/main/CHANGELOG.md",
    upgradeGuideUrl: "https://github.com/ItsLhuis/remit/blob/main/docs/operations/UPGRADE.md"
  })
})

test("accepts a plain repository url without the git prefix or suffix", () => {
  const links = getReleaseLinks("https://github.com/someone/remit-fork")

  expect(links?.changelogUrl).toBe("https://github.com/someone/remit-fork/blob/main/CHANGELOG.md")
})

test("returns no links when the repository is not a GitHub https url", () => {
  const links = getReleaseLinks("git@gitlab.com:someone/remit.git")

  expect(links).toBeNull()
})
