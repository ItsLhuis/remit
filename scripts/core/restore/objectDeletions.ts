import { type StorageBucketName } from "@/lib/storage/bucketNames"

import { isArchivableObjectKey, isBackupArchiveKey } from "../backup/objectPlan"

export type ObjectLocation = {
  role: StorageBucketName
  key: string
}

// What "replace, not merge" deletes: every live object of an archived bucket that the archive does
// not contain. Matched by role and key together, since the same key may exist in both buckets. Two
// kinds of object are never among them, because no archive could have carried either, so absence
// from this one says nothing about them: a backup archive a remote destination wrote into the
// bucket — it may be the very archive being restored or the history after it — and an object under
// a key a backup leaves out (`objectPlan.ts`'s `isArchivableObjectKey`), which was never Remit's.
export function planObjectDeletions(
  archived: readonly ObjectLocation[],
  live: readonly ObjectLocation[]
): ObjectLocation[] {
  const keep = new Set(archived.map((object) => `${object.role}/${object.key}`))

  return live.filter(
    (object) =>
      !isBackupArchiveKey(object.key) &&
      isArchivableObjectKey(object.role, object.key) &&
      !keep.has(`${object.role}/${object.key}`)
  )
}
