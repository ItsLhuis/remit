import type { Readable } from "node:stream"

export class TarTruncatedError extends Error {
  constructor() {
    super("Archive ended before the tar entry was complete.")
  }
}

export class AsyncBufferReader {
  private readonly iterator: AsyncIterator<Buffer>
  private readonly buffers: Buffer[] = []
  private bufferedLength = 0
  private ended = false

  constructor(input: Readable) {
    this.iterator = input[Symbol.asyncIterator]()
  }

  async readExactly(length: number): Promise<Buffer | null> {
    if (length === 0) return Buffer.alloc(0)

    await this.fill(length)

    if (this.bufferedLength === 0 && this.ended) return null

    if (this.bufferedLength < length) throw new TarTruncatedError()

    return this.take(length)
  }

  async readBuffer(length: number): Promise<Buffer> {
    const buffer = await this.readExactly(length)

    if (!buffer) throw new TarTruncatedError()

    return buffer
  }

  async drainBytes(length: number, onChunk: (chunk: Buffer) => Promise<void>): Promise<void> {
    let remaining = length

    while (remaining > 0) {
      if (this.bufferedLength === 0) await this.fill(1)

      if (this.bufferedLength === 0) throw new TarTruncatedError()

      const chunk = this.take(Math.min(remaining, this.buffers[0]?.length ?? remaining))
      remaining -= chunk.length

      await onChunk(chunk)
    }
  }

  async skipBytes(length: number): Promise<void> {
    await this.drainBytes(length, async () => undefined)
  }

  async drain(): Promise<void> {
    while (!this.ended) {
      await this.fill(this.bufferedLength + 1)

      if (this.bufferedLength > 0) this.take(this.bufferedLength)
    }
  }

  private async fill(length: number): Promise<void> {
    while (this.bufferedLength < length && !this.ended) {
      const result = await this.iterator.next()

      if (result.done) {
        this.ended = true
        return
      }

      const buffer = Buffer.isBuffer(result.value) ? result.value : Buffer.from(result.value)

      if (buffer.length === 0) continue

      this.buffers.push(buffer)
      this.bufferedLength += buffer.length
    }
  }

  private take(length: number): Buffer {
    const chunks: Buffer[] = []
    let remaining = length

    while (remaining > 0) {
      const first = this.buffers[0]

      if (!first) break

      if (first.length <= remaining) {
        chunks.push(first)
        this.buffers.shift()
        this.bufferedLength -= first.length
        remaining -= first.length
        continue
      }

      chunks.push(first.subarray(0, remaining))
      this.buffers[0] = first.subarray(remaining)
      this.bufferedLength -= remaining
      remaining = 0
    }

    return Buffer.concat(chunks)
  }
}
