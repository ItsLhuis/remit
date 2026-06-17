import { createWriteStream } from "node:fs"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { pipeline } from "node:stream/promises"

import {
  buildDestinationAdapter,
  validateBackupCredentials,
  type BackupDestination,
  type BackupDestinationAdapter
} from "../destination"
import { readBackupCredentialsFromSettings } from "../destination/credentials"

import { RestoreCliError } from "./errors"

type Database = typeof import("@/database").database
type SettingsRow = Awaited<ReturnType<Database["query"]["settings"]["findFirst"]>>

export type RestoreSource =
  | { type: "local"; path: string }
  | {
      destination: Exclude<BackupDestination, "local">
      key: string
      type: "remote"
      uri: string
    }

export function parseRestoreSource(value: string): RestoreSource {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    return { type: "local", path: value }
  }

  if (url.protocol !== "remit:") {
    return { type: "local", path: value }
  }

  const destination = parseRemoteRestoreDestination(url.hostname)
  const key = decodeURIComponent(url.pathname.replace(/^\//, ""))

  if (!destination || !key) {
    throw new RestoreCliError(
      "Refusing restore: remote archive URI must match remit://<destination>/<key>, where destination is s3, r2, or b2.",
      "remote-restore-uri-invalid",
      false
    )
  }

  return {
    destination,
    key,
    type: "remote",
    uri: `remit://${destination}/${key}`
  }
}

export function parseRemoteRestoreDestination(
  value: string
): Exclude<BackupDestination, "local"> | null {
  return value === "s3" || value === "r2" || value === "b2" ? value : null
}

export function formatRestoreSourceForAudit(source: RestoreSource): string {
  return source.type === "remote" ? source.uri : path.resolve(source.path)
}

export async function downloadRemoteRestoreArchive(
  source: Extract<RestoreSource, { type: "remote" }>,
  database: Database,
  workDir: string | null
): Promise<string> {
  if (!workDir) {
    throw new RestoreCliError(
      "Refusing restore: restore work directory was not prepared.",
      "restore-workdir-missing"
    )
  }

  const settingsRow = await database.query.settings.findFirst()
  const adapter = buildRemoteRestoreAdapter(source.destination, settingsRow)
  const archivePath = path.join(workDir, "remote-source.remitbak")
  await mkdir(workDir, { recursive: true })
  await pipeline(await adapter.get(source.key), createWriteStream(archivePath, { flags: "wx" }))

  return archivePath
}

function buildRemoteRestoreAdapter(
  destination: Exclude<BackupDestination, "local">,
  settingsRow: SettingsRow
): BackupDestinationAdapter {
  const credentials = readBackupCredentialsFromSettings(settingsRow)
  const validation = validateBackupCredentials(destination, credentials)

  if (!validation.ok) {
    throw new RestoreCliError(validation.reason, "remote-restore-credentials-invalid", false)
  }

  return buildDestinationAdapter(destination, credentials)
}
