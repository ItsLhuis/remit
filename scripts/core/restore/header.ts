import { timingSafeEqual } from "node:crypto"

import { open } from "node:fs/promises"

import {
  ARCHIVE_HEADER_LENGTH,
  AUTH_TAG_LENGTH,
  ENCRYPTION_ALGORITHM_BYTE,
  HEADER_MAGIC,
  computeKeyFingerprint,
  readArchiveHeader,
  type HeaderDescriptor
} from "../archive/header"

import { RestoreCliError } from "./errors"
import { SUPPORTED_ARCHIVE_VERSIONS, type SupportedArchiveVersion } from "./manifestSchema"

export type { HeaderDescriptor }

export async function readAndValidateRestoreHeader(
  archivePath: string,
  encryptionKey: Buffer
): Promise<HeaderDescriptor> {
  const headerBuffer = await readHeaderBuffer(archivePath)
  const header = parseHeaderWithRestoreMessages(headerBuffer)

  if (
    !SUPPORTED_ARCHIVE_VERSIONS.includes(header.archiveFormatVersion as SupportedArchiveVersion)
  ) {
    const maxSupportedVersion = Math.max(...SUPPORTED_ARCHIVE_VERSIONS)

    if (header.archiveFormatVersion > maxSupportedVersion) {
      throw new RestoreCliError(
        `Refusing restore: archive format version ${header.archiveFormatVersion} is newer than this build supports. Upgrade Remit to a build that supports archive format ${header.archiveFormatVersion} before restoring.`,
        "archive-version-unsupported",
        false
      )
    }

    throw new RestoreCliError(
      `Refusing restore: archive format version ${header.archiveFormatVersion} is not supported by this build. Choose an archive produced by a supported Remit release.`,
      "archive-version-unsupported",
      false
    )
  }

  const liveFingerprint = Buffer.from(computeKeyFingerprint(encryptionKey), "hex")
  const archiveFingerprint = Buffer.from(header.keyFingerprint, "hex")

  if (
    archiveFingerprint.length !== liveFingerprint.length ||
    !timingSafeEqual(archiveFingerprint, liveFingerprint)
  ) {
    throw new RestoreCliError(
      "Refusing restore: this archive was encrypted with a different REMIT_ENCRYPTION_KEY. Start the instance with the original encryption key or choose a backup created with the current key.",
      "key-fingerprint-mismatch",
      false
    )
  }

  return header
}

function parseHeaderWithRestoreMessages(headerBuffer: Buffer): HeaderDescriptor {
  try {
    return readArchiveHeader(headerBuffer)
  } catch {
    if (!headerBuffer.subarray(0, HEADER_MAGIC.length).equals(HEADER_MAGIC)) {
      throw new RestoreCliError(
        "Refusing restore: archive is not a Remit backup file. Choose a .remitbak archive created by pnpm remit:backup.",
        "archive-magic-invalid",
        false
      )
    }

    if (headerBuffer.readUInt8(12) !== ENCRYPTION_ALGORITHM_BYTE) {
      throw new RestoreCliError(
        "Refusing restore: archive encryption algorithm is not supported. Choose an AES-256-GCM .remitbak archive created by this Remit release.",
        "archive-algorithm-unsupported",
        false
      )
    }

    if (
      !headerBuffer.subarray(13, 16).equals(Buffer.alloc(3)) ||
      !headerBuffer.subarray(44, 64).equals(Buffer.alloc(20))
    ) {
      throw new RestoreCliError(
        "Refusing restore: archive header reserved bytes are non-zero. The archive format is invalid; create a fresh backup or restore from another archive.",
        "archive-reserved-bytes-invalid",
        false
      )
    }

    throw new RestoreCliError(
      "Refusing restore: archive header is invalid. Choose a .remitbak archive created by pnpm remit:backup.",
      "archive-header-invalid",
      false
    )
  }
}

async function readHeaderBuffer(archivePath: string): Promise<Buffer> {
  const file = await open(archivePath, "r")
  const buffer = Buffer.alloc(ARCHIVE_HEADER_LENGTH)

  try {
    const { bytesRead } = await file.read(buffer, 0, ARCHIVE_HEADER_LENGTH, 0)

    if (bytesRead !== ARCHIVE_HEADER_LENGTH) {
      throw new RestoreCliError(
        "Refusing restore: archive is too small to contain a Remit backup header.",
        "archive-header-too-small",
        false
      )
    }

    return buffer
  } finally {
    await file.close()
  }
}

export async function readAuthTag(archivePath: string, fileSize: number): Promise<Buffer> {
  const file = await open(archivePath, "r")
  const buffer = Buffer.alloc(AUTH_TAG_LENGTH)

  try {
    const { bytesRead } = await file.read(buffer, 0, AUTH_TAG_LENGTH, fileSize - AUTH_TAG_LENGTH)

    if (bytesRead !== AUTH_TAG_LENGTH) {
      throw new RestoreCliError(
        "Refusing restore: archive is missing the AES-GCM authentication tag.",
        "archive-auth-tag-missing"
      )
    }

    return buffer
  } finally {
    await file.close()
  }
}
