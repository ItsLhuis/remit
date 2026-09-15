import { describe, expect, test } from "vitest"

import { releaseChangelog } from "../changelog"

const header = ["# Changelog", "", "Intro prose with a - dash in it.", ""]

describe("releaseChangelog", () => {
  test("promotes the unreleased entries into a dated section below a fresh unreleased heading", () => {
    const content = [...header, "## [Unreleased]", "", "### Added", "", "- A new report.", ""].join(
      "\n"
    )

    const result = releaseChangelog(content, "1.1.0", "2026-09-14")

    expect(result).toEqual({
      ok: true,
      content: [
        ...header,
        "## [Unreleased]",
        "",
        "## [1.1.0] - 2026-09-14",
        "",
        "### Added",
        "",
        "- A new report.",
        ""
      ].join("\n")
    })
  })

  test("keeps earlier releases below the new one untouched", () => {
    const content = [
      ...header,
      "## [Unreleased]",
      "",
      "### Fixed",
      "",
      "- A rounding defect.",
      "",
      "## [1.0.0] - 2026-01-01",
      "",
      "### Added",
      "",
      "- The first release.",
      ""
    ].join("\n")

    const result = releaseChangelog(content, "1.0.1", "2026-09-14")

    expect(result.ok && result.content.split("\n").slice(4, 9)).toEqual([
      "## [Unreleased]",
      "",
      "## [1.0.1] - 2026-09-14",
      "",
      "### Fixed"
    ])
    expect(
      result.ok &&
        result.content.endsWith("## [1.0.0] - 2026-01-01\n\n### Added\n\n- The first release.\n")
    ).toBe(true)
  })

  test("refuses when the unreleased section has no entries", () => {
    const content = [
      ...header,
      "## [Unreleased]",
      "",
      "### Added",
      "",
      "## [1.0.0] - 2026-01-01",
      "",
      "- The first release.",
      ""
    ].join("\n")

    const result = releaseChangelog(content, "1.0.1", "2026-09-14")

    expect(result).toEqual({ ok: false, reason: "emptyUnreleased" })
  })

  test("refuses when the changelog has no unreleased heading", () => {
    const content = [...header, "## [1.0.0] - 2026-01-01", "", "- The first release.", ""].join(
      "\n"
    )

    const result = releaseChangelog(content, "1.0.1", "2026-09-14")

    expect(result).toEqual({ ok: false, reason: "missingUnreleased" })
  })

  test("refuses when the new version already has a section", () => {
    const content = [
      ...header,
      "## [Unreleased]",
      "",
      "- Something new.",
      "",
      "## [1.0.1] - 2026-01-01",
      ""
    ].join("\n")

    const result = releaseChangelog(content, "1.0.1", "2026-09-14")

    expect(result).toEqual({ ok: false, reason: "versionExists" })
  })

  test("reads a changelog checked out with CRLF line endings", () => {
    const content = [...header, "## [Unreleased]", "", "- Something new.", ""].join("\r\n")

    const result = releaseChangelog(content, "1.0.1", "2026-09-14")

    expect(result.ok && result.content).toBe(
      [
        ...header,
        "## [Unreleased]",
        "",
        "## [1.0.1] - 2026-09-14",
        "",
        "- Something new.",
        ""
      ].join("\n")
    )
  })
})
