import { once } from "node:events"
import { type Writable } from "node:stream"
import { crc32, deflateRawSync } from "node:zlib"

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50

const VERSION_NEEDED = 20
// Bit 11 declares the file name as UTF-8. Without it a reader falls back to CP437 and mangles every
// non-ASCII upload name, which is most of them for a non-English instance.
const FLAG_UTF8_NAMES = 0x0800

const METHOD_STORE = 0
const METHOD_DEFLATE = 8

// Zip64 is deliberately not implemented: every size and offset field below is 32 bits, so an entry or
// an archive that crosses 4 GiB has to fail loudly here rather than write a header that readers
// silently misinterpret. An instance whose export exceeds this needs the zip64 central directory
// records, not a wider cast.
const MAX_ZIP32_SIZE = 0xffffffff

export class ZipSizeLimitError extends Error {
  constructor(readonly entryPath: string) {
    super(`Zip entry exceeds the 4 GiB zip32 limit: ${entryPath}`)
  }
}

export type ZipWriterOptions = {
  // Every entry's DOS timestamp. Fixed for one archive on purpose: an export is one artifact taken at
  // one instant, and a per-entry clock read would make two runs over identical data differ.
  modifiedAt?: Date
}

type CentralDirectoryRecord = {
  path: string
  method: number
  crc: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
  dosTime: number
  dosDate: number
}

// A minimal zip writer over `node:zlib`, the same shape as the backup path's hand-rolled ustar writer
// in `scripts/core/archive/tar.ts` and for the same reason: one container format, no dependency, and
// every byte accounted for. Entries are buffered one at a time rather than streamed through the
// deflater, because a stored entry's local header carries its CRC and both sizes *before* the data,
// and computing those needs the whole entry anyway.
export class ZipWriter {
  private readonly records: CentralDirectoryRecord[] = []
  private readonly dosTime: number
  private readonly dosDate: number

  private offset = 0

  constructor(
    private readonly output: Writable,
    options: ZipWriterOptions = {}
  ) {
    const modifiedAt = options.modifiedAt ?? new Date()

    this.dosTime = toDosTime(modifiedAt)
    this.dosDate = toDosDate(modifiedAt)
  }

  async writeEntry(
    path: string,
    content: Buffer,
    options: { compress?: boolean } = {}
  ): Promise<void> {
    const compress = options.compress ?? true
    const deflated = compress ? deflateRawSync(content) : null
    // A deflate that grew the input happens on already-compressed bytes (a JPEG, a PDF); storing them
    // is both smaller and cheaper to read back.
    const useDeflate = deflated !== null && deflated.length < content.length
    const payload = useDeflate ? deflated : content

    if (content.length > MAX_ZIP32_SIZE || payload.length > MAX_ZIP32_SIZE) {
      throw new ZipSizeLimitError(path)
    }

    const record: CentralDirectoryRecord = {
      path,
      method: useDeflate ? METHOD_DEFLATE : METHOD_STORE,
      crc: crc32(content),
      compressedSize: payload.length,
      uncompressedSize: content.length,
      localHeaderOffset: this.offset,
      dosTime: this.dosTime,
      dosDate: this.dosDate
    }

    await this.write(buildLocalFileHeader(record))
    await this.write(payload)

    this.records.push(record)
  }

  async finalize(): Promise<void> {
    const centralDirectoryOffset = this.offset

    for (const record of this.records) {
      await this.write(buildCentralDirectoryHeader(record))
    }

    const centralDirectorySize = this.offset - centralDirectoryOffset

    if (this.offset > MAX_ZIP32_SIZE) throw new ZipSizeLimitError("<archive>")

    await this.write(
      buildEndOfCentralDirectory({
        entryCount: this.records.length,
        centralDirectoryOffset,
        centralDirectorySize
      })
    )

    this.output.end()
  }

  private async write(buffer: Buffer): Promise<void> {
    if (!this.output.write(buffer)) {
      await once(this.output, "drain")
    }

    this.offset += buffer.length
  }
}

function buildLocalFileHeader(record: CentralDirectoryRecord): Buffer {
  const name = Buffer.from(record.path, "utf8")
  const header = Buffer.alloc(30 + name.length)

  header.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0)
  header.writeUInt16LE(VERSION_NEEDED, 4)
  header.writeUInt16LE(FLAG_UTF8_NAMES, 6)
  header.writeUInt16LE(record.method, 8)
  header.writeUInt16LE(record.dosTime, 10)
  header.writeUInt16LE(record.dosDate, 12)
  header.writeUInt32LE(record.crc, 14)
  header.writeUInt32LE(record.compressedSize, 18)
  header.writeUInt32LE(record.uncompressedSize, 22)
  header.writeUInt16LE(name.length, 26)
  header.writeUInt16LE(0, 28)
  name.copy(header, 30)

  return header
}

function buildCentralDirectoryHeader(record: CentralDirectoryRecord): Buffer {
  const name = Buffer.from(record.path, "utf8")
  const header = Buffer.alloc(46 + name.length)

  header.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0)
  header.writeUInt16LE(VERSION_NEEDED, 4)
  header.writeUInt16LE(VERSION_NEEDED, 6)
  header.writeUInt16LE(FLAG_UTF8_NAMES, 8)
  header.writeUInt16LE(record.method, 10)
  header.writeUInt16LE(record.dosTime, 12)
  header.writeUInt16LE(record.dosDate, 14)
  header.writeUInt32LE(record.crc, 16)
  header.writeUInt32LE(record.compressedSize, 20)
  header.writeUInt32LE(record.uncompressedSize, 24)
  header.writeUInt16LE(name.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(0, 38)
  header.writeUInt32LE(record.localHeaderOffset, 42)
  name.copy(header, 46)

  return header
}

type EndOfCentralDirectoryInput = {
  entryCount: number
  centralDirectoryOffset: number
  centralDirectorySize: number
}

function buildEndOfCentralDirectory(input: EndOfCentralDirectoryInput): Buffer {
  const record = Buffer.alloc(22)

  record.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0)
  record.writeUInt16LE(0, 4)
  record.writeUInt16LE(0, 6)
  record.writeUInt16LE(input.entryCount, 8)
  record.writeUInt16LE(input.entryCount, 10)
  record.writeUInt32LE(input.centralDirectorySize, 12)
  record.writeUInt32LE(input.centralDirectoryOffset, 16)
  record.writeUInt16LE(0, 20)

  return record
}

// MS-DOS date/time, the only timestamp a base zip entry carries: two-second resolution and an epoch
// of 1980. A date before 1980 cannot be represented, so it clamps to the epoch rather than writing a
// negative year that readers reject.
function toDosTime(value: Date): number {
  return (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2)
}

function toDosDate(value: Date): number {
  const year = Math.max(value.getFullYear(), 1980)

  return ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate()
}
