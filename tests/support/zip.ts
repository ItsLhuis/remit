import { inflateRawSync } from "node:zlib"

export type ZipEntry = {
  content: Buffer
  method: number
  path: string
}

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_MAGIC = Buffer.from([0x50, 0x4b, 0x05, 0x06])

// Reads an archive the way an unzip tool does — from the end-of-central-directory record backwards —
// rather than by walking local headers front to back. That is the half a hand-rolled writer gets wrong
// silently: an archive whose local headers are right and whose central directory is wrong extracts
// under some tools and fails under others. Shared by `lib/archive`'s unit tests and the data-export
// integration tests so both assert against the same reading of the format.
export function readZipEntries(archive: Buffer): ZipEntry[] {
  const endOffset = archive.lastIndexOf(END_OF_CENTRAL_DIRECTORY_MAGIC)

  if (endOffset === -1) throw new Error("No end-of-central-directory record found")

  const entryCount = archive.readUInt16LE(endOffset + 10)
  const centralDirectoryOffset = archive.readUInt32LE(endOffset + 16)
  const entries: ZipEntry[] = []

  let cursor = centralDirectoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Central directory header ${index} has a bad signature`)
    }

    const method = archive.readUInt16LE(cursor + 10)
    const compressedSize = archive.readUInt32LE(cursor + 20)
    const nameLength = archive.readUInt16LE(cursor + 28)
    const localHeaderOffset = archive.readUInt32LE(cursor + 42)
    const path = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8")

    const localNameLength = archive.readUInt16LE(localHeaderOffset + 26)
    const dataStart = localHeaderOffset + 30 + localNameLength
    const stored = archive.subarray(dataStart, dataStart + compressedSize)

    entries.push({ path, method, content: method === 8 ? inflateRawSync(stored) : stored })

    cursor += 46 + nameLength
  }

  return entries
}

export function readZipJson(archive: Buffer, path: string): unknown {
  const entry = readZipEntries(archive).find((candidate) => candidate.path === path)

  if (!entry) throw new Error(`Archive has no entry at ${path}`)

  return JSON.parse(entry.content.toString("utf8"))
}
