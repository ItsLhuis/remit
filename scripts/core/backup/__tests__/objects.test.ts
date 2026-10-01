import { Readable } from "node:stream"

import { describe, expect, test } from "vitest"

import { type StorageBucketRole } from "@/lib/storage/bucketNames"
import { type ObjectStore, type StoredObjectRead } from "@/lib/storage/objectStore"

import { type UploadRowLocation } from "../objectPlan"
import {
  assertListingCoversUploads,
  BackupObjectError,
  collectArchivedObjects,
  listArchivedObjects
} from "../objects"

// Only `headObject` is reached by the cross-check; the rest of the store is never called here.
function storeWithObjects(present: ReadonlySet<string>): ObjectStore {
  const unused = () => {
    throw new Error("not used by the cross-check")
  }

  return {
    listObjects: unused,
    getObject: unused,
    putObject: unused,
    deleteObject: unused,
    ensureBucket: unused,
    headObject: async (role, key) => (present.has(`${role}/${key}`) ? { size: 1 } : null)
  }
}

describe("assertListingCoversUploads", () => {
  test("fails the backup when a file the database names exists but the listing left it out", async () => {
    const store = storeWithObjects(new Set(["documents/attachments/b.pdf"]))

    await expect(
      assertListingCoversUploads(
        store,
        [{ role: "public", key: "logos/a.png", size: 1 }],
        [
          { bucket: "public", path: "logos/a.png" },
          { bucket: "documents", path: "attachments/b.pdf" }
        ]
      )
    ).rejects.toBeInstanceOf(BackupObjectError)
  })

  test("counts a row whose object is truly gone instead of failing every backup over it", async () => {
    const store = storeWithObjects(new Set())

    const result = await assertListingCoversUploads(
      store,
      [{ role: "public", key: "logos/a.png", size: 1 }],
      [
        { bucket: "public", path: "logos/a.png" },
        { bucket: "public", path: "avatars/u/gone.png" }
      ]
    )

    expect(result).toEqual({ missingObjectCount: 1 })
  })
})

type MemoryStore = {
  store: ObjectStore
  objects: Map<string, Buffer>
}

function missingObjectError(): Error {
  return Object.assign(new Error("NoSuchKey"), { $metadata: { httpStatusCode: 404 } })
}

// An in-memory store. `onListed` runs after each object the listing yields, which is where a
// test makes something happen to the store while a backup is still reading it.
function memoryStore(
  initial: Record<string, string>,
  onListed: (role: StorageBucketRole, key: string, objects: Map<string, Buffer>) => void = () =>
    undefined
): MemoryStore {
  const objects = new Map(Object.entries(initial).map(([path, body]) => [path, Buffer.from(body)]))
  const unused = () => {
    throw new Error("not used by a backup")
  }

  const store: ObjectStore = {
    async *listObjects(role) {
      const keys = [...objects.keys()]
        .filter((path) => path.startsWith(`${role}/`))
        .map((path) => path.slice(role.length + 1))

      for (const key of keys) {
        const body = objects.get(`${role}/${key}`)

        if (!body) continue

        yield { key, size: body.length }

        onListed(role, key, objects)
      }
    },
    async headObject(role, key) {
      const body = objects.get(`${role}/${key}`)

      return body ? { size: body.length } : null
    },
    async getObject(role, key) {
      const body = objects.get(`${role}/${key}`)

      if (!body) throw missingObjectError()

      return {
        body: Readable.from([body]) as unknown as StoredObjectRead["body"],
        contentLength: body.length,
        contentType: "image/png"
      }
    },
    putObject: unused,
    deleteObject: unused,
    ensureBucket: unused
  }

  return { store, objects }
}

describe("listArchivedObjects", () => {
  test("leaves out backup archives a remote destination wrote into a storage bucket", async () => {
    const { store } = memoryStore({
      "public/logos/a.png": "a",
      "public/remit-backups/2026/09/remit-backup-20260930T010203Z-v1.0.0.remitbak": "archive"
    })

    const listed = await listArchivedObjects(store)

    expect(listed.objects.map((object) => object.key)).toEqual(["logos/a.png"])
    expect(listed.unarchivableObjectCount).toBe(0)
  })

  test("leaves out and counts an object whose key an archive cannot hold, instead of failing every backup", async () => {
    const { store } = memoryStore({
      "public/logos/a.png": "a",
      "public/reports/": "",
      "documents/line\nbreak.pdf": "x"
    })

    const listed = await listArchivedObjects(store)

    expect(listed.objects.map((object) => object.key)).toEqual(["logos/a.png"])
    expect(listed.unarchivableObjectCount).toBe(2)
  })
})

describe("collectArchivedObjects", () => {
  test("reads the upload rows before listing, so a file uploaded during the listing does not fail the backup", async () => {
    const rows: UploadRowLocation[] = [{ bucket: "public", path: "logos/a.png" }]
    const { store } = memoryStore({ "public/logos/a.png": "a" }, (role, key, objects) => {
      if (key !== "logos/a.png") return

      // The upload route writes the object first and its row second, both after this key was listed.
      objects.set("public/avatars/u/new.png", Buffer.from("new"))
      rows.push({ bucket: "public", path: "avatars/u/new.png" })
    })

    const result = await collectArchivedObjects(store, async () => [...rows])

    expect(result.objects.map((object) => object.key)).toEqual(["logos/a.png"])
    expect(result.missingObjectCount).toBe(0)
  })

  test("leaves out a file deleted after it was listed and counts it, rather than failing the backup", async () => {
    const { store } = memoryStore(
      { "public/logos/a.png": "a", "public/logos/b.png": "b" },
      (role, key, objects) => {
        if (key === "logos/b.png") objects.delete("public/logos/b.png")
      }
    )

    const result = await collectArchivedObjects(store, async () => [
      { bucket: "public", path: "logos/a.png" }
    ])

    expect(result.objects.map((object) => object.key)).toEqual(["logos/a.png"])
    expect(result.missingObjectCount).toBe(1)
  })

  test("fails the backup when the store refuses a read, rather than counting the file as deleted", async () => {
    const { store } = memoryStore({ "public/logos/a.png": "a" })
    const refusing: ObjectStore = {
      ...store,
      getObject: async () => {
        throw Object.assign(new Error("AccessDenied"), { $metadata: { httpStatusCode: 403 } })
      }
    }

    await expect(
      collectArchivedObjects(refusing, async () => [{ bucket: "public", path: "logos/a.png" }])
    ).rejects.toThrow("AccessDenied")
  })

  test("fails the backup when a file the database names sits under a key an archive cannot hold", async () => {
    const { store } = memoryStore({ "public/reports/": "" })

    await expect(
      collectArchivedObjects(store, async () => [{ bucket: "public", path: "reports/" }])
    ).rejects.toBeInstanceOf(BackupObjectError)
  })
})
