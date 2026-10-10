import { type StorageBucketRole } from "./bucketNames"

export type ReleasedObject = {
  bucket: StorageBucketRole
  key: string
}

// The uploads a delete released: every one something referenced before it ran and nothing
// references after it. Computing it as that difference, rather than from a list of the columns a
// deleted row carries, is what makes cascades safe — an invoice's credit notes and attachments go
// with it through `ON DELETE CASCADE`, and their uploads drop out of the "after" set without anyone
// having listed them. It is also what keeps this from being an orphan sweep: an upload nothing
// referenced before the delete is not in the "before" set, so it is never touched.
export function selectReleasedUploadIds(
  referencedBefore: Iterable<string>,
  referencedAfter: Iterable<string>
): string[] {
  const stillReferenced = new Set(referencedAfter)

  return [...new Set(referencedBefore)].filter((uploadId) => !stillReferenced.has(uploadId))
}

export function dedupeReleasedObjects(objects: readonly ReleasedObject[]): ReleasedObject[] {
  const seen = new Set<string>()

  return objects.filter((object) => {
    const identity = `${object.bucket}\u0000${object.key}`

    if (seen.has(identity)) return false

    seen.add(identity)

    return true
  })
}
