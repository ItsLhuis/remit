import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"

import {
  buildDestinationAdapter,
  type BackupCredentials,
  type BackupDestination
} from "@/lib/backups/destination"

export type BackupConnectionTestErrorCode =
  | "auth"
  | "connection"
  | "not_found"
  | "permission"
  | "probe_not_removed"
  | "provider_failed"

export type BackupConnectionTestOutcome = {
  // True only when the probe object was written *and* removed. A run that wrote and could not
  // delete throws instead, because the debris matters more to the operator than the good news.
  probeRemoved: true
}

export class BackupConnectionTestError extends Error {
  constructor(
    readonly code: BackupConnectionTestErrorCode,
    readonly cause: unknown
  ) {
    super(code)
    this.name = "BackupConnectionTestError"
  }
}

// Deliberately not under `remit-backups/`, which is the prefix `enforceRemoteRetention` in
// scripts/core/backup/writeArchive.ts lists and prunes: a probe object there would be treated as an
// archive, and a probe written today would hold the newest daily slot and let a real archive be
// deleted in its place.
const PROBE_KEY_PREFIX = "remit-connection-test/"

const PROBE_BODY = Buffer.from("remit backup destination connection test\n", "utf8")

// A backup writes and, through retention, deletes. Listing a bucket proves neither, and a
// destination that reads but cannot write is exactly the one that fails at 02:00 with an archive
// nobody has, so the test performs both operations for real on a throwaway object.
export async function testBackupConnection(
  destination: BackupDestination,
  credentials: BackupCredentials
): Promise<BackupConnectionTestOutcome> {
  const adapter = buildDestinationAdapter(destination, credentials)
  const key = `${PROBE_KEY_PREFIX}${randomUUID()}.probe`

  try {
    await adapter.put(key, Readable.from(PROBE_BODY), PROBE_BODY.byteLength)
  } catch (error) {
    throw new BackupConnectionTestError(mapDestinationError(error), error)
  }

  try {
    await adapter.delete(key)
  } catch (error) {
    throw new BackupConnectionTestError("probe_not_removed", error)
  }

  return { probeRemoved: true }
}

function mapDestinationError(error: unknown): BackupConnectionTestErrorCode {
  const name = getErrorName(error)

  switch (name) {
    case "InvalidAccessKeyId":
    case "SignatureDoesNotMatch":
    case "AuthorizationHeaderMalformed":
    case "ExpiredToken":
    case "InvalidToken":
      return "auth"
    case "AccessDenied":
    case "AllAccessDisabled":
      return "permission"
    case "NoSuchBucket":
    case "NotFound":
      return "not_found"
    case "ENOTFOUND":
    case "ECONNREFUSED":
    case "ETIMEDOUT":
    case "TimeoutError":
      return "connection"
    case null:
      return "provider_failed"
    default:
      return "provider_failed"
  }
}

function getErrorName(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null

  if ("code" in error && typeof error.code === "string") return error.code
  if ("name" in error && typeof error.name === "string") return error.name

  return null
}
