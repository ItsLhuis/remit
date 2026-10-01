import { expect, test } from "vitest"

import { planObjectDeletions } from "../objectDeletions"

test("deletes only live objects the archive does not contain, bucket by bucket", () => {
  const deletions = planObjectDeletions(
    [
      { role: "public", key: "logos/kept.png" },
      { role: "documents", key: "attachments/kept.pdf" }
    ],
    [
      { role: "public", key: "logos/kept.png" },
      { role: "public", key: "logos/stale.png" },
      { role: "documents", key: "attachments/kept.pdf" },
      { role: "documents", key: "logos/kept.png" }
    ]
  )

  expect(deletions).toEqual([
    { role: "public", key: "logos/stale.png" },
    { role: "documents", key: "logos/kept.png" }
  ])
})

test("deletes nothing when the live store holds only archived objects", () => {
  expect(
    planObjectDeletions([{ role: "public", key: "a.png" }], [{ role: "public", key: "a.png" }])
  ).toEqual([])
})

test("never deletes an object under a key no archive could have carried", () => {
  expect(
    planObjectDeletions(
      [{ role: "public", key: "logos/kept.png" }],
      [
        { role: "public", key: "logos/kept.png" },
        { role: "public", key: "reports/" },
        { role: "documents", key: "a//b.pdf" },
        { role: "documents", key: "line\nbreak.pdf" }
      ]
    )
  ).toEqual([])
})

test("never deletes a backup archive a remote destination wrote into a storage bucket", () => {
  expect(
    planObjectDeletions(
      [{ role: "public", key: "logos/kept.png" }],
      [
        { role: "public", key: "logos/kept.png" },
        {
          role: "public",
          key: "remit-backups/2026/09/remit-backup-20260930T010203Z-v1.0.0.remitbak"
        }
      ]
    )
  ).toEqual([])
})
