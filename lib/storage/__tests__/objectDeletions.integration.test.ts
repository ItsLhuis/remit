import { beforeEach, expect, test, vi } from "vitest"

import { objectDeletions } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { drainObjectDeletions } from "../objectDeletions"
import { type ObjectStore } from "../objectStore"

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

function storeWith(deleteObject: ObjectStore["deleteObject"]): ObjectStore {
  return {
    deleteObject,
    listObjects: vi.fn(),
    headObject: vi.fn(),
    getObject: vi.fn(),
    putObject: vi.fn(),
    ensureBucket: vi.fn()
  }
}

async function queue(keys: string[]): Promise<void> {
  await database
    .insert(objectDeletions)
    .values(keys.map((key) => ({ bucket: "public" as const, key })))
}

beforeEach(() => {
  vi.clearAllMocks()
})

test("a later sweep finishes what a store outage left queued", async () => {
  await queue(["a.png", "b.png"])

  const outage = await drainObjectDeletions({
    store: storeWith(vi.fn().mockRejectedValue(new Error("ECONNREFUSED")))
  })
  const recovered = await drainObjectDeletions({
    store: storeWith(vi.fn().mockResolvedValue(undefined))
  })

  expect(outage).toEqual({ deleted: 0, failed: 2 })
  expect(recovered).toEqual({ deleted: 2, failed: 0 })
  expect(await database.select().from(objectDeletions)).toEqual([])
})

test("stops after three refusals in a row rather than waiting out every key", async () => {
  await queue(["a.png", "b.png", "c.png", "d.png", "e.png"])

  const deleteObject = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"))

  const result = await drainObjectDeletions({ store: storeWith(deleteObject) })

  expect(deleteObject).toHaveBeenCalledTimes(3)
  expect(result).toEqual({ deleted: 0, failed: 3 })
})

test("tries untried keys before one the store keeps refusing", async () => {
  await queue(["poison.png"])
  await drainObjectDeletions({
    store: storeWith(vi.fn().mockRejectedValue(new Error("AccessDenied")))
  })
  await queue(["fresh.png"])

  const deleteObject = vi.fn().mockResolvedValue(undefined)

  await drainObjectDeletions({ store: storeWith(deleteObject), limit: 1 })

  expect(deleteObject.mock.calls).toEqual([
    ["public", "fresh.png"],
    ["public", "poison.png"]
  ])
})

test("drains only the ids it is given", async () => {
  await queue(["mine.png", "other.png"])

  const [mine] = await database.select().from(objectDeletions).limit(1)
  const deleteObject = vi.fn().mockResolvedValue(undefined)

  await drainObjectDeletions({ store: storeWith(deleteObject), ids: mine ? [mine.id] : [] })

  expect(deleteObject).toHaveBeenCalledTimes(1)
  expect(await database.select().from(objectDeletions)).toHaveLength(1)
})
