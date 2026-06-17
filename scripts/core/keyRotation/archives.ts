import { randomUUID } from "node:crypto"
import { readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

import type postgres from "postgres"

import { reencryptArchiveBuffer } from "../archive/reencrypt"
import { DEFAULT_BACKUP_DIRNAME, REMOTE_BACKUP_PREFIX } from "../backup/filename"
import {
  buildDestinationAdapter,
  validateBackupCredentials,
  type BackupDestination,
  type BackupDestinationAdapter
} from "../destination"
import { isMissingPathError } from "../utils/fs"

import { writeRotationAudit } from "./audit"
import { redactRotationReason } from "./redact"
import { readBackupSettings } from "./settings"

type Sql = postgres.Sql

export type ArchivePlan =
  | {
      destination: "local"
      key: string
      path: string
      size: number
    }
  | {
      adapter: BackupDestinationAdapter
      destination: Exclude<BackupDestination, "local">
      key: string
      size: number
    }

export type ArchiveReencryptionResult = {
  changed: boolean
  destination: BackupDestination
  key: string
  size: number
}

export async function listArchivePlans(
  client: Sql,
  options: { newKey: Buffer; oldKey: Buffer; remitDataDir: string },
  settingsKey: Buffer
): Promise<ArchivePlan[]> {
  const localPlans = await listLocalArchives(
    path.join(options.remitDataDir, DEFAULT_BACKUP_DIRNAME)
  )
  const settings = await readBackupSettings(client, settingsKey)

  if (!settings || settings.destination === "local") {
    return localPlans
  }

  const remoteValidation = validateBackupCredentials(settings.destination, settings)

  if (!remoteValidation.ok) {
    console.warn(`Skipping ${settings.destination} backup archive scan: ${remoteValidation.reason}`)
    return localPlans
  }

  const adapter = buildDestinationAdapter(settings.destination, settings)
  const remoteObjects = await adapter.list(REMOTE_BACKUP_PREFIX)
  const remotePlans = remoteObjects
    .filter((object) => object.key.endsWith(".remitbak"))
    .map(
      (object): ArchivePlan => ({
        adapter,
        destination: settings.destination as Exclude<BackupDestination, "local">,
        key: object.key,
        size: object.size
      })
    )

  return [...localPlans, ...remotePlans]
}

async function listLocalArchives(rootDirectory: string): Promise<ArchivePlan[]> {
  const root = path.resolve(rootDirectory)
  const files = await listLocalArchiveFiles(root)

  return files.map(
    (file): ArchivePlan => ({
      destination: "local",
      key: path.relative(root, file.path).split(path.sep).join("/"),
      path: file.path,
      size: file.size
    })
  )
}

async function listLocalArchiveFiles(
  directory: string
): Promise<Array<{ path: string; size: number }>> {
  try {
    const stats = await stat(directory)

    if (stats.isFile() && directory.endsWith(".remitbak")) {
      return [{ path: directory, size: stats.size }]
    }
    if (!stats.isDirectory()) return []
  } catch (error) {
    if (isMissingPathError(error)) return []
    throw error
  }

  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        if (entry.name === ".tmp") return []
        return await listLocalArchiveFiles(absolutePath)
      }

      if (entry.isFile() && entry.name.endsWith(".remitbak")) {
        const stats = await stat(absolutePath)
        return [{ path: absolutePath, size: stats.size }]
      }

      return []
    })
  )

  return nested.flat().sort((left, right) => left.path.localeCompare(right.path))
}

export async function reencryptConfiguredArchives(
  client: Sql,
  options: { newKey: Buffer; oldKey: Buffer; remitDataDir: string },
  operationId: string
): Promise<{ failures: number; reencrypted: number }> {
  const archivePlans = await listArchivePlans(client, options, options.newKey)

  let reencrypted = 0
  let failures = 0

  for (const archive of archivePlans) {
    try {
      const result = await reencryptArchive(archive, options)
      if (!result.changed) continue

      reencrypted += 1

      await writeRotationAudit(client, "instance.key_rotation.backup_reencrypted", {
        operationId,
        archive: formatArchiveForAudit(result),
        destination: result.destination,
        size: result.size
      })
    } catch (error) {
      failures += 1
      console.error(
        `Backup archive re-encryption failed for ${formatArchivePlanForCli(archive)}. ${redactRotationReason(error)}`
      )
    }
  }

  return { failures, reencrypted }
}

async function reencryptArchive(
  archive: ArchivePlan,
  options: { newKey: Buffer; oldKey: Buffer }
): Promise<ArchiveReencryptionResult> {
  const original =
    archive.destination === "local"
      ? await readFile(archive.path)
      : await collectStream(await archive.adapter.get(archive.key))
  const rotated = reencryptArchiveBuffer({
    archive: original,
    newKey: options.newKey,
    oldKey: options.oldKey
  })

  if (rotated === original) {
    return {
      changed: false,
      destination: archive.destination,
      key: archive.key,
      size: archive.size
    }
  }

  if (archive.destination === "local") {
    const tempPath = `${archive.path}.${randomUUID()}.tmp`

    try {
      await writeFile(tempPath, rotated, { flag: "wx" })
      await rename(tempPath, archive.path)
    } catch (error) {
      await rm(tempPath, { force: true })
      throw error
    }
  } else {
    await archive.adapter.put(archive.key, Readable.from(rotated), rotated.length)
  }

  return {
    changed: true,
    destination: archive.destination,
    key: archive.key,
    size: rotated.length
  }
}

async function collectStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

export function formatArchiveForAudit(result: ArchiveReencryptionResult): string {
  return result.destination === "local" ? result.key : `remit://${result.destination}/${result.key}`
}

export function formatArchivePlanForCli(archive: ArchivePlan): string {
  return archive.destination === "local"
    ? archive.path
    : `remit://${archive.destination}/${archive.key}`
}
