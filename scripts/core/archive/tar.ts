import { once } from "node:events"
import type { Readable, Writable } from "node:stream"

export const TAR_BLOCK_SIZE = 512

export type TarEntry = {
  name: string
  size: number
  type: "directory" | "file"
}

export type TarBufferEntry = {
  name: string
  content: Buffer
}

export class TarPathTooLongError extends Error {
  constructor(readonly archivePath: string) {
    super(`Archive path is too long for ustar: ${archivePath}`)
  }
}

export class TarFieldTooLongError extends Error {
  constructor(readonly value: string) {
    super(`Tar field is too long: ${value}`)
  }
}

export class TarWriter {
  constructor(private readonly output: Writable) {}

  async writeBufferEntry(name: string, buffer: Buffer): Promise<void> {
    await this.writeHeader(name, buffer.length)
    await writeToStream(this.output, buffer)
    await this.writePadding(buffer.length)
  }

  async writeFileEntry(name: string, size: number, source: Readable): Promise<void> {
    await this.writeHeader(name, size)

    for await (const chunk of source) {
      await writeToStream(this.output, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    await this.writePadding(size)
  }

  async finalize(): Promise<void> {
    await writeToStream(this.output, Buffer.alloc(TAR_BLOCK_SIZE * 2))
    this.output.end()
  }

  private async writeHeader(name: string, size: number): Promise<void> {
    await writeToStream(this.output, buildTarHeader({ name, size }))
  }

  private async writePadding(size: number): Promise<void> {
    const remainder = size % TAR_BLOCK_SIZE
    if (remainder === 0) return

    await writeToStream(this.output, Buffer.alloc(TAR_BLOCK_SIZE - remainder))
  }
}

export async function writeToStream(output: Writable, buffer: Buffer): Promise<void> {
  if (!output.write(buffer)) {
    await once(output, "drain")
  }
}

export function buildTarHeader(input: { name: string; size: number }): Buffer {
  const header = Buffer.alloc(TAR_BLOCK_SIZE, 0)
  const nameParts = splitTarName(input.name)

  writeAscii(header, nameParts.name, 0, 100)
  writeOctal(header, 0o644, 100, 8)
  writeOctal(header, 0, 108, 8)
  writeOctal(header, 0, 116, 8)
  writeOctal(header, input.size, 124, 12)
  writeOctal(header, Math.floor(Date.now() / 1000), 136, 12)
  // The 8-byte checksum field is treated as ASCII spaces while the
  // unsigned byte sum is computed; the result is written below.
  header.fill(0x20, 148, 156)
  header.write("0", 156, 1, "ascii")
  header.write("ustar\0", 257, 6, "ascii")
  header.write("00", 263, 2, "ascii")
  writeAscii(header, "remit", 265, 32)
  writeAscii(header, "remit", 297, 32)
  writeAscii(header, nameParts.prefix, 345, 155)

  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  writeOctal(header, checksum, 148, 8)

  return header
}

export function splitTarName(value: string): { name: string; prefix: string } {
  const normalized = value.replaceAll("\\", "/")

  if (Buffer.byteLength(normalized, "utf8") <= 100) {
    return { name: normalized, prefix: "" }
  }

  const slashIndex = normalized.lastIndexOf("/")

  if (slashIndex === -1) throw new TarPathTooLongError(normalized)

  const prefix = normalized.slice(0, slashIndex)
  const name = normalized.slice(slashIndex + 1)

  if (Buffer.byteLength(name, "utf8") > 100 || Buffer.byteLength(prefix, "utf8") > 155) {
    throw new TarPathTooLongError(normalized)
  }

  return { name, prefix }
}

export function writeAscii(buffer: Buffer, value: string, offset: number, length: number): void {
  const bytes = Buffer.from(value, "utf8")

  if (bytes.length > length) throw new TarFieldTooLongError(value)

  bytes.copy(buffer, offset)
}

export function writeOctal(buffer: Buffer, value: number, offset: number, length: number): void {
  // ustar numeric fields are zero-padded octal terminated by NUL + space.
  const field = `${value.toString(8).padStart(length - 2, "0")}\0 `

  buffer.write(field, offset, length, "ascii")
}

export function readTarString(buffer: Buffer, offset: number, length: number): string {
  const field = buffer.subarray(offset, offset + length)
  const end = field.indexOf(0)

  return field.subarray(0, end === -1 ? field.length : end).toString("utf8")
}

export function isZeroBlock(buffer: Buffer): boolean {
  return buffer.equals(Buffer.alloc(buffer.length))
}

export function paddingFor(size: number): number {
  const remainder = size % TAR_BLOCK_SIZE

  return remainder === 0 ? 0 : TAR_BLOCK_SIZE - remainder
}

export type ParseTarEntryResult =
  | { kind: "entry"; entry: TarEntry }
  | { kind: "invalid-size" }
  | { kind: "unsupported-type"; name: string }

export function parseTarHeader(header: Buffer): ParseTarEntryResult {
  const name = readTarString(header, 0, 100)
  const prefix = readTarString(header, 345, 155)
  const fullName = prefix ? `${prefix}/${name}` : name
  const size = Number.parseInt(readTarString(header, 124, 12).trim() || "0", 8)
  const typeFlag = header.subarray(156, 157).toString("ascii")

  if (!Number.isFinite(size) || size < 0) return { kind: "invalid-size" }

  if (typeFlag === "5") return { kind: "entry", entry: { name: fullName, size, type: "directory" } }

  if (typeFlag !== "0" && typeFlag !== "\0") return { kind: "unsupported-type", name: fullName }

  return { kind: "entry", entry: { name: fullName, size, type: "file" } }
}

export function parseTarEntries(tar: Buffer): TarBufferEntry[] {
  const entries: TarBufferEntry[] = []
  let offset = 0

  while (offset + TAR_BLOCK_SIZE <= tar.length) {
    const header = tar.subarray(offset, offset + TAR_BLOCK_SIZE)

    if (isZeroBlock(header)) break

    const result = parseTarHeader(header)

    if (result.kind === "invalid-size") throw new Error("Archive tar entry has an invalid size.")

    if (result.kind === "unsupported-type") {
      throw new Error(`Archive entry ${result.name} is not a regular file.`)
    }

    const contentStart = offset + TAR_BLOCK_SIZE
    const contentEnd = contentStart + result.entry.size

    entries.push({
      name: result.entry.name,
      content: Buffer.from(tar.subarray(contentStart, contentEnd))
    })

    offset = contentStart + result.entry.size + paddingFor(result.entry.size)
  }

  return entries
}

export function writeTarEntries(entries: readonly TarBufferEntry[]): Buffer {
  return Buffer.concat([
    ...entries.map((entry) =>
      Buffer.concat([
        buildTarHeader({ name: entry.name, size: entry.content.length }),
        entry.content,
        Buffer.alloc(paddingFor(entry.content.length))
      ])
    ),
    Buffer.alloc(TAR_BLOCK_SIZE * 2)
  ])
}
