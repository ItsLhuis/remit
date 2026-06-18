import { mkdir, readdir, rename, rm, stat } from "node:fs/promises"
import path from "node:path"

import { isMissingPathError, pathExists } from "../utils/fs"
import { hashFile } from "../utils/hash"

import { RestoreCliError } from "./errors"
import { type ChecksumDescriptor } from "./verifyArchive"

export type AtomicSwapResult = {
  previousUploadsDir: string | null
  restoredUploadsDir: string
}

export async function applyUploadsAtomicSwap(input: {
  expectedUploads: ChecksumDescriptor[]
  liveUploadsDir: string
  stagingUploadsDir: string
  timestamp: string
}): Promise<AtomicSwapResult> {
  const liveUploadsDir = path.resolve(input.liveUploadsDir)
  const stagingUploadsDir = path.resolve(input.stagingUploadsDir)
  const parentDir = path.dirname(liveUploadsDir)
  const liveName = path.basename(liveUploadsDir)
  const previousUploadsDir = path.join(parentDir, `.${liveName}.previous-${input.timestamp}`)
  let liveMoved = false
  let stagingMoved = false

  await verifyUploadsDirectory(stagingUploadsDir, input.expectedUploads)
  await mkdir(parentDir, { recursive: true })
  await rm(previousUploadsDir, { recursive: true, force: true })

  try {
    if (await pathExists(liveUploadsDir)) {
      await rename(liveUploadsDir, previousUploadsDir)
      liveMoved = true
    }

    await rename(stagingUploadsDir, liveUploadsDir)
    stagingMoved = true

    await verifyUploadsDirectory(liveUploadsDir, input.expectedUploads)

    if (liveMoved) {
      await rm(previousUploadsDir, { recursive: true, force: true })
    }

    return {
      previousUploadsDir: liveMoved ? previousUploadsDir : null,
      restoredUploadsDir: liveUploadsDir
    }
  } catch (error) {
    // Roll back to original layout. Undoing the staging move is best-effort: its
    // failure must never prevent the authoritative step below, which restores the
    // operator's previous uploads from previousUploadsDir back to liveUploadsDir.
    if (stagingMoved) {
      try {
        await rename(liveUploadsDir, stagingUploadsDir)
      } catch {
        await rm(liveUploadsDir, { recursive: true, force: true }).catch(() => undefined)
      }
    }

    if (liveMoved && (await pathExists(previousUploadsDir))) {
      await rename(previousUploadsDir, liveUploadsDir)
    }

    throw error
  }
}

export async function verifyUploadsDirectory(
  rootDir: string,
  expectedUploads: ChecksumDescriptor[]
): Promise<void> {
  const expected = new Map(expectedUploads.map((upload) => [upload.path, upload]))
  const actualFiles = await listFiles(rootDir)

  if (actualFiles.length !== expected.size) {
    throw new RestoreCliError(
      "Uploads verification failed after restore. The previous uploads directory has been restored.",
      "uploads-verification-failed"
    )
  }

  for (const filePath of actualFiles) {
    const relativePath = path.relative(rootDir, filePath).split(path.sep).join("/")
    const descriptor = expected.get(`uploads/${relativePath}`)

    if (!descriptor) {
      throw new RestoreCliError(
        "Uploads verification failed after restore. The previous uploads directory has been restored.",
        "uploads-verification-failed"
      )
    }

    const [fileStats, sha256] = await Promise.all([stat(filePath), hashFile(filePath)])

    if (fileStats.size !== descriptor.size || sha256 !== descriptor.sha256) {
      throw new RestoreCliError(
        "Uploads verification failed after restore. The previous uploads directory has been restored.",
        "uploads-verification-failed"
      )
    }
  }
}

async function listFiles(rootDir: string): Promise<string[]> {
  try {
    const stats = await stat(rootDir)

    if (!stats.isDirectory()) return []
  } catch (error) {
    if (isMissingPathError(error)) return []
    throw error
  }

  const entries = await readdir(rootDir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(rootDir, entry.name)

      if (entry.isDirectory()) return await listFiles(absolutePath)
      if (entry.isFile()) return [absolutePath]

      return []
    })
  )

  return files.flat().sort((a, b) => a.localeCompare(b))
}
