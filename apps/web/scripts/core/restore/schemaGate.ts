import { RestoreCliError } from "./errors"

export type ArchiveSchemaComparison =
  | { kind: "same"; migration: string }
  | { kind: "older"; archiveMigration: string; currentMigration: string }
  | { kind: "newer"; archiveMigration: string; currentMigration: string }

// The manifest's `schemaMigrationId` against the migration journal this build ships
// (`drizzle/migrations/meta/_journal.json`), whose last tag is the schema a restore ends on once
// `postRestoreMigrations.ts` has run. "none" is what `backup/plan.ts`'s
// `getLatestAppliedMigrationId` records for a database with no migration applied, so it sorts before
// every tag.
//
// A tag the journal does not hold is treated as newer, never as older: it was written by a build
// ahead of this one, or by a fork whose migrations this build has never seen, and either way there
// is no forward path from it — migrations only run forwards, so the restored database would sit
// under a build that does not match it, with nothing to say so until a query failed.
export function compareArchiveSchema(
  archiveMigration: string,
  journalTags: readonly string[]
): ArchiveSchemaComparison {
  const currentMigration = journalTags.at(-1) ?? "none"

  if (archiveMigration === currentMigration) return { kind: "same", migration: currentMigration }

  const archiveIndex = archiveMigration === "none" ? -1 : journalTags.indexOf(archiveMigration)

  if (archiveMigration !== "none" && archiveIndex === -1) {
    return { kind: "newer", archiveMigration, currentMigration }
  }

  return { kind: "older", archiveMigration, currentMigration }
}

export function describeArchiveSchema(comparison: ArchiveSchemaComparison): string {
  switch (comparison.kind) {
    case "same":
      return `same as this build (${comparison.migration})`
    case "older":
      return `older than this build: ${comparison.archiveMigration}, migrated forward to ${comparison.currentMigration} after the restore`
    case "newer":
      return `not known to this build: ${comparison.archiveMigration}, newer than ${comparison.currentMigration} or from another build; a restore is refused`
  }
}

// Migrations only run forwards, so a database restored from a newer schema would sit under a build
// that cannot read it, and nothing here could migrate it back. A dry run applies the same refusal so
// it fails exactly when the real restore would.
export function assertArchiveSchemaRestorable(comparison: ArchiveSchemaComparison): void {
  if (comparison.kind !== "newer") return

  throw new RestoreCliError(
    `Refusing restore: the archive was taken at schema migration ${comparison.archiveMigration}, which this build does not know; it is at ${comparison.currentMigration}. Upgrade to the build that wrote the archive, then restore.`,
    "archive-schema-newer"
  )
}
