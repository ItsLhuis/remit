import chalk from "chalk"

import { formatBytes } from "../utils/format"

import { type RestoreManifest } from "./manifestSchema"
import { describeArchiveSchema, type ArchiveSchemaComparison } from "./schemaGate"
import { type StagedObject } from "./verifyArchive"

export function formatDryRunSummary(input: {
  archivePath: string
  databaseName: string
  manifest: RestoreManifest
  objects: readonly StagedObject[]
  schemaComparison: ArchiveSchemaComparison
}): string {
  const countFor = (role: StagedObject["role"]) => {
    const objects = input.objects.filter((object) => object.role === role)

    return `${objects.length} files, ${formatBytes(objects.reduce((sum, object) => sum + object.size, 0))}`
  }

  return [
    `${chalk.bold("Archive")}: ${input.archivePath}`,
    `${chalk.bold("Created")}: ${input.manifest.createdAt}`,
    `${chalk.bold("Archive format")}: ${input.manifest.archiveFormatVersion}`,
    `${chalk.bold("Archive app version")}: ${input.manifest.appVersion}`,
    `${chalk.bold("Schema migration")}: ${describeArchiveSchema(input.schemaComparison)}`,
    `${chalk.bold("Destination recorded")}: ${input.manifest.destination}`,
    `${chalk.bold("Database target")}: ${input.databaseName}`,
    `${chalk.bold("Database dump")}: ${formatBytes(input.manifest.components.database.size)}`,
    `${chalk.bold("Stored files (public)")}: ${countFor("public")}`,
    `${chalk.bold("Stored files (documents)")}: ${countFor("documents")}`,
    "",
    "Would create a mandatory local pre-restore snapshot, write and verify every archived file, run pg_restore with --single-transaction, apply forward migrations, and delete stored files the archive does not contain."
  ].join("\n")
}
