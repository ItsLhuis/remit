import { expect, test } from "vitest"

import { dedupeReleasedObjects, selectReleasedUploadIds } from "../objectOwnership"

test("releases an upload whose last reference the delete removed", () => {
  const released = selectReleasedUploadIds(["a", "b", "c"], ["b"])

  expect(released).toEqual(["a", "c"])
})

test("never releases an upload nothing referenced before the delete", () => {
  const released = selectReleasedUploadIds(["a"], [])

  expect(released).not.toContain("orphan")
  expect(released).toEqual(["a"])
})

test("counts an upload referenced twice before the delete once", () => {
  const released = selectReleasedUploadIds(["a", "a", "b"], ["b"])

  expect(released).toEqual(["a"])
})

test("queues the same object once however many rows released it", () => {
  const objects = dedupeReleasedObjects([
    { bucket: "documents", key: "x.pdf" },
    { bucket: "documents", key: "x.pdf" },
    { bucket: "exports", key: "x.pdf" }
  ])

  expect(objects).toEqual([
    { bucket: "documents", key: "x.pdf" },
    { bucket: "exports", key: "x.pdf" }
  ])
})
