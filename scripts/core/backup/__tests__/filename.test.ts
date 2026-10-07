import path from "node:path"

import { expect, test } from "vitest"

import {
  buildBackupFilename,
  buildPreRestoreSnapshotPath,
  buildPreRotationBackupPath,
  parseBackupFilenameTimestamp
} from "../filename"

const CREATED_AT = new Date("2026-10-06T01:00:07.000Z")

test("reads the time back from a name the backup wrote", () => {
  const filename = buildBackupFilename(CREATED_AT, "1.0.0")

  expect(parseBackupFilenameTimestamp(filename)).toEqual(CREATED_AT)
})

test("reads a name written by a pre-release build", () => {
  const filename = buildBackupFilename(CREATED_AT, "1.2.0-beta.3")

  expect(parseBackupFilenameTimestamp(filename)).toEqual(CREATED_AT)
})

test.each(["1.0.0", "1.2.0-beta.3"])(
  "never reads a pre-restore snapshot as a retained archive (version %s)",
  (version) => {
    const filename = path.basename(buildPreRestoreSnapshotPath("/data", CREATED_AT, version))

    expect(parseBackupFilenameTimestamp(filename)).toBeNull()
  }
)

test("never reads a pre-rotation backup as a retained archive", () => {
  const filename = path.basename(buildPreRotationBackupPath("/data", CREATED_AT))

  expect(parseBackupFilenameTimestamp(filename)).toBeNull()
})

test.each(["fixture.remitbak", "remit-backup-20261006T010007Z-v1.0.0.remitbak.tmp", ".tmp"])(
  "ignores a file the backup did not name: %s",
  (filename) => {
    expect(parseBackupFilenameTimestamp(filename)).toBeNull()
  }
)
