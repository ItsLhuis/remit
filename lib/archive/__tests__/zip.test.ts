import { PassThrough } from "node:stream"

import { describe, expect, test } from "vitest"

import { readZipEntries } from "@/tests/support/zip"

import { ZipSizeLimitError, ZipWriter } from "../zip"

async function writeArchive(write: (writer: ZipWriter) => Promise<void>): Promise<Buffer> {
  const output = new PassThrough()
  const chunks: Buffer[] = []

  output.on("data", (chunk: Buffer) => chunks.push(chunk))

  const writer = new ZipWriter(output, { modifiedAt: new Date("2026-08-12T10:20:30.000Z") })

  await write(writer)
  await writer.finalize()

  return Buffer.concat(chunks)
}

describe("ZipWriter", () => {
  test("round-trips a deflated text entry through the central directory", async () => {
    const content = Buffer.from(JSON.stringify({ clients: ["acme"] }).repeat(20), "utf8")

    const archive = await writeArchive((writer) => writer.writeEntry("data/clients.json", content))

    const [entry] = readZipEntries(archive)

    expect(entry).toEqual({ path: "data/clients.json", method: 8, content })
  })

  test("stores an entry unchanged when deflating would grow it", async () => {
    const content = Buffer.from([0x1f, 0x8b, 0x42, 0xff, 0x00, 0x91])

    const archive = await writeArchive((writer) => writer.writeEntry("files/logo.png", content))

    const [entry] = readZipEntries(archive)

    expect(entry).toEqual({ path: "files/logo.png", method: 0, content })
  })

  test("stores an entry unchanged when compression is switched off", async () => {
    const content = Buffer.from("a".repeat(5_000), "utf8")

    const archive = await writeArchive((writer) =>
      writer.writeEntry("files/receipt.pdf", content, { compress: false })
    )

    const [entry] = readZipEntries(archive)

    expect(entry.method).toBe(0)
    expect(entry.content).toEqual(content)
  })

  test("keeps every entry findable when several are written in sequence", async () => {
    const archive = await writeArchive(async (writer) => {
      await writer.writeEntry("index.json", Buffer.from('{"scope":"instance"}', "utf8"))
      await writer.writeEntry("data/invoices.json", Buffer.from("[]", "utf8"))
      await writer.writeEntry("files/uploads/a.png", Buffer.from([1, 2, 3]))
    })

    expect(readZipEntries(archive).map((entry) => entry.path)).toEqual([
      "index.json",
      "data/invoices.json",
      "files/uploads/a.png"
    ])
  })

  test("preserves a non-ASCII entry name", async () => {
    const archive = await writeArchive((writer) =>
      writer.writeEntry("files/facturação-2026.pdf", Buffer.from("pdf", "utf8"))
    )

    expect(readZipEntries(archive)[0]?.path).toBe("files/facturação-2026.pdf")
  })

  test("writes an empty but valid archive when nothing is added", async () => {
    const archive = await writeArchive(async () => {})

    expect(archive).toHaveLength(22)
    expect(readZipEntries(archive)).toEqual([])
  })

  test("rejects an entry larger than the zip32 size limit", async () => {
    const output = new PassThrough()

    output.resume()

    const writer = new ZipWriter(output)
    const oversized = { length: 0x1_0000_0000 } as unknown as Buffer

    await expect(
      writer.writeEntry("files/huge.bin", oversized, { compress: false })
    ).rejects.toThrow(ZipSizeLimitError)
  })
})
