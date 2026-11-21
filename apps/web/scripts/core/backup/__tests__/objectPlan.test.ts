import { describe, expect, test } from "vitest"

import {
  findUnlistedUploads,
  isArchivableObjectKey,
  isBackupArchiveKey,
  parseArchivedObjectPath,
  toArchivedContentType,
  toObjectArchivePath
} from "../objectPlan"

describe("object archive paths", () => {
  test("records an object under its bucket role, not the bucket's name", () => {
    expect(toObjectArchivePath("documents", "documents/invoice/a/b.pdf")).toBe(
      "objects/documents/documents/invoice/a/b.pdf"
    )
  })

  test("reads a version 2 path back into its role and key", () => {
    expect(parseArchivedObjectPath("objects/public/avatars/u/a.png")).toEqual({
      role: "public",
      key: "avatars/u/a.png"
    })
    expect(parseArchivedObjectPath("objects/documents/attachments/x.pdf")).toEqual({
      role: "documents",
      key: "attachments/x.pdf"
    })
  })

  test("refuses a path outside objects/, an unknown role, or an empty key", () => {
    expect(parseArchivedObjectPath("logos/a.png")).toBeNull()
    expect(parseArchivedObjectPath("objects/exports/a.zip")).toBeNull()
    expect(parseArchivedObjectPath("objects/public/")).toBeNull()
    expect(parseArchivedObjectPath("database/remit.dump")).toBeNull()
  })
})

describe("isArchivableObjectKey", () => {
  test("accepts every key shape the application writes", () => {
    expect(
      isArchivableObjectKey(
        "documents",
        "documents/contract_signed/0f8fad5b-d9cb-469f-a165-70867728950e/AAAAAAAAAAAAAAAAAAAAAA.pdf"
      )
    ).toBe(true)
    expect(
      isArchivableObjectKey(
        "public",
        "avatars/0f8fad5b-d9cb-469f-a165-70867728950e/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp"
      )
    ).toBe(true)
  })

  test("refuses a key a restore could not write back safely", () => {
    for (const key of ["", "/abs.png", "a//b.png", "a/../b.png", "./a.png", "a\\b.png", "a/"]) {
      expect(isArchivableObjectKey("public", key)).toBe(false)
    }
  })

  test("refuses a key with a line break or another control character, which would split its checksum line", () => {
    for (const key of ["a\nb.png", "a\rb.png", "a\tb.png", "a\u0000b.png", "a\u007fb.png"]) {
      expect(isArchivableObjectKey("public", key)).toBe(false)
    }
  })

  test("refuses a key too long for a ustar entry", () => {
    expect(isArchivableObjectKey("public", `${"a".repeat(101)}`)).toBe(false)
    expect(isArchivableObjectKey("public", `${"d/".repeat(80)}file.png`)).toBe(false)
  })
})

describe("findUnlistedUploads", () => {
  test("returns every upload row whose object the listing did not contain", () => {
    const listed = {
      public: new Set(["logos/a.png"]),
      documents: new Set(["attachments/b.pdf"])
    }

    const unlisted = findUnlistedUploads(listed, [
      { bucket: "public", path: "logos/a.png" },
      { bucket: "public", path: "avatars/u/c.png" },
      { bucket: "documents", path: "attachments/b.pdf" },
      { bucket: "documents", path: "documents/invoice/i/d.pdf" }
    ])

    expect(unlisted).toEqual([
      { bucket: "public", path: "avatars/u/c.png" },
      { bucket: "documents", path: "documents/invoice/i/d.pdf" }
    ])
  })

  test("looks a row up in its own bucket only", () => {
    const listed = { public: new Set(["x.pdf"]), documents: new Set<string>() }

    expect(findUnlistedUploads(listed, [{ bucket: "documents", path: "x.pdf" }])).toEqual([
      { bucket: "documents", path: "x.pdf" }
    ])
  })
})

describe("isBackupArchiveKey", () => {
  test("recognises the keys a remote backup destination writes, and no key the application mints", () => {
    expect(
      isBackupArchiveKey("remit-backups/2026/09/remit-backup-20260930T010203Z-v1.0.0.remitbak")
    ).toBe(true)
    expect(isBackupArchiveKey("logos/remit-backups.png")).toBe(false)
    expect(isBackupArchiveKey("documents/invoice/1/2.pdf")).toBe(false)
  })
})

describe("toArchivedContentType", () => {
  test("keeps a content type a restore's manifest check accepts", () => {
    expect(toArchivedContentType("image/png")).toBe("image/png")
  })

  test("falls back to a generic type for a missing, empty or overlong one, so the archive stays restorable", () => {
    expect(toArchivedContentType(null)).toBe("application/octet-stream")
    expect(toArchivedContentType("")).toBe("application/octet-stream")
    expect(toArchivedContentType(`image/${"x".repeat(300)}`)).toBe("application/octet-stream")
  })
})
