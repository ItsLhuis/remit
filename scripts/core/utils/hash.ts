import { createHash } from "node:crypto"

import { createReadStream } from "node:fs"

export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256")
  const stream = createReadStream(filePath)

  for await (const chunk of stream) {
    hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return hash.digest("hex")
}

export function sha256Hex(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex")
}
