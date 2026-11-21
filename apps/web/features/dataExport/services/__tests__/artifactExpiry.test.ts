import { expect, test } from "vitest"

import {
  getExportArtifactCutoff,
  getExportArtifactExpiresAt,
  isExportArtifactExpired
} from "../artifactExpiry"

const PRODUCED_AT = new Date("2026-06-01T12:00:00.000Z")

test("an artifact expires one week after it was produced", () => {
  const expiresAt = getExportArtifactExpiresAt(PRODUCED_AT)

  expect(expiresAt).toEqual(new Date("2026-06-08T12:00:00.000Z"))
})

test("an artifact is still downloadable until the moment it expires", () => {
  expect(isExportArtifactExpired(PRODUCED_AT, new Date("2026-06-08T11:59:59.999Z"))).toBe(false)
  expect(isExportArtifactExpired(PRODUCED_AT, new Date("2026-06-08T12:00:00.000Z"))).toBe(true)
})

test("the sweep cutoff selects exactly the artifacts that have expired", () => {
  const now = new Date("2026-06-08T12:00:00.000Z")

  const cutoff = getExportArtifactCutoff(now)

  expect(cutoff).toEqual(PRODUCED_AT)
  expect(isExportArtifactExpired(cutoff, now)).toBe(true)
})
