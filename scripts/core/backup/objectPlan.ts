import { type StorageBucketName } from "@/lib/storage/bucketNames"

import { splitTarName, TarPathTooLongError } from "../archive/tar"

import { REMOTE_BACKUP_PREFIX } from "./filename"

// Which of an instance's buckets a backup archives. The exports bucket is left out on purpose
// (ADR-0046): its objects are whole-instance exports and report PDFs, each regenerable from the
// database the archive already carries.
export const ARCHIVED_BUCKET_ROLES: readonly StorageBucketName[] = ["public", "documents"]

const OBJECT_ARCHIVE_PREFIX = "objects/"

// The bound `restore/manifestSchema.ts` puts on a recorded content type. An archive recording one
// outside it would be refused by its own restore, so the backup records the generic type instead.
const MAX_CONTENT_TYPE_LENGTH = 255
const FALLBACK_CONTENT_TYPE = "application/octet-stream"

export type ArchivedObjectLocation = {
  role: StorageBucketName
  key: string
}

export type ObjectBucketTotals = {
  fileCount: number
  totalSize: number
}

export type UploadRowLocation = {
  bucket: StorageBucketName
  path: string
}

// The bucket's role, never its physical name, so an archive restores into an instance whose
// `S3_BUCKET` differs from the one that wrote it.
export function toObjectArchivePath(role: StorageBucketName, key: string): string {
  return `${OBJECT_ARCHIVE_PREFIX}${role}/${key}`
}

export function parseArchivedObjectPath(archivePath: string): ArchivedObjectLocation | null {
  if (!archivePath.startsWith(OBJECT_ARCHIVE_PREFIX)) return null

  const rest = archivePath.slice(OBJECT_ARCHIVE_PREFIX.length)
  const separator = rest.indexOf("/")

  if (separator === -1) return null

  const role = rest.slice(0, separator)
  const key = rest.slice(separator + 1)

  if (!key || !ARCHIVED_BUCKET_ROLES.includes(role as StorageBucketName)) return null

  return { role: role as StorageBucketName, key }
}

// The same rules restore's `validateArchivePath` enforces on the way back in, checked on the way
// out so a backup never writes an archive its own restore would refuse. Every key the application
// mints passes; a key that does not was put in the bucket by something else — a folder marker a
// provider's console created, say — so a backup leaves it out and a restore never deletes it
// (`restore/objectDeletions.ts`'s `planObjectDeletions`).
export function isArchivableObjectKey(role: StorageBucketName, key: string): boolean {
  if (key.length === 0 || key.startsWith("/") || key.includes("\\")) return false

  if (hasControlCharacter(key)) return false

  if (key.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false
  }

  try {
    splitTarName(toObjectArchivePath(role, key))

    return true
  } catch (error) {
    if (error instanceof TarPathTooLongError) return false

    throw error
  }
}

// `checksums.sha256` holds one path per line, so a path carrying a line break would split its own
// line and restore's `parseChecksums` would refuse the whole archive over it. Every control
// character goes with it: none appears in a key the application mints.
export function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0

    if (code < 0x20 || code === 0x7f) return true
  }

  return false
}

// Where a remote backup destination writes its archives (`filename.ts`'s `buildRemoteBackupKey`).
// Nothing stops an operator from pointing that destination at the very bucket Remit keeps its files
// in, and those archives are not stored files: a backup that archived them would carry every earlier
// archive inside the next one, and a restore that deleted them as absent from its archive would
// erase the backup history it was restored from.
export function isBackupArchiveKey(key: string): boolean {
  return key.startsWith(REMOTE_BACKUP_PREFIX)
}

export function toArchivedContentType(contentType: string | null): string {
  if (!contentType || contentType.length > MAX_CONTENT_TYPE_LENGTH) return FALLBACK_CONTENT_TYPE

  return contentType
}

// Every `uploads` row whose object the listing did not contain. A row can outlive its object only
// through an interrupted delete, but a listing that ends early looks exactly the same from here, so
// the caller asks the store about each one before deciding which it is.
export function findUnlistedUploads<TRow extends UploadRowLocation>(
  listed: Record<StorageBucketName, ReadonlySet<string>>,
  rows: readonly TRow[]
): TRow[] {
  return rows.filter((row) => !listed[row.bucket].has(row.path))
}

// One line per archived file, database first: restore reads this before any entry it describes, so
// every entry is verified as it streams past.
export function buildChecksumsFile(
  databaseDump: { sha256: string },
  objects: ReadonlyArray<{ archivePath: string; sha256: string }>
): string {
  return [
    `${databaseDump.sha256}  database/remit.dump`,
    ...objects.map((object) => `${object.sha256}  ${object.archivePath}`)
  ]
    .join("\n")
    .concat("\n")
}

export function totalArchivedObjects(
  objects: ReadonlyArray<{ role: StorageBucketName; size: number }>
): Record<StorageBucketName, ObjectBucketTotals> {
  const totals: Record<StorageBucketName, ObjectBucketTotals> = {
    public: { fileCount: 0, totalSize: 0 },
    documents: { fileCount: 0, totalSize: 0 }
  }

  for (const object of objects) {
    totals[object.role].fileCount += 1
    totals[object.role].totalSize += object.size
  }

  return totals
}
