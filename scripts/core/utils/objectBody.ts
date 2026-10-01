import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { type ReadableStream as NodeReadableStream } from "node:stream/web"

import { type StoredObjectRead } from "@/lib/storage/objectStore"

export function toNodeReadable(read: StoredObjectRead): Readable {
  if (read.body instanceof Readable) return read.body

  return Readable.fromWeb(read.body.transformToWebStream() as NodeReadableStream)
}

export async function hashStoredObject(
  read: StoredObjectRead
): Promise<{ sha256: string; size: number }> {
  const hash = createHash("sha256")
  let size = 0

  for await (const chunk of toNodeReadable(read)) {
    const bytes = chunk as Buffer

    size += bytes.length
    hash.update(bytes)
  }

  return { sha256: hash.digest("hex"), size }
}
