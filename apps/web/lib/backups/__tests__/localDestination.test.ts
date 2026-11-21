import { mkdtemp, readdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"

import { afterEach, beforeEach, expect, test } from "vitest"

import { buildDestinationAdapter } from "../destination"

let rootDir: string

function buildLocalAdapter() {
  return buildDestinationAdapter("local", {
    accessKey: null,
    bucket: null,
    endpoint: null,
    localDirectory: rootDir,
    region: null,
    secretKey: null
  })
}

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "remit-local-destination-"))
})

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true })
})

function putText(key: string, text: string) {
  const adapter = buildLocalAdapter()
  const body = Buffer.from(text)

  return adapter.put(key, Readable.from(body), body.byteLength)
}

test("deleting the last key under a prefix leaves no directory behind", async () => {
  const adapter = buildLocalAdapter()
  await putText("remit-connection-test/probe.probe", "probe")

  await adapter.delete("remit-connection-test/probe.probe")

  expect(await readdir(rootDir)).toEqual([])
})

test("deleting a key keeps a prefix that still holds another", async () => {
  const adapter = buildLocalAdapter()
  await putText("remit-backups/2026/10/a.remitbak", "a")
  await putText("remit-backups/2026/10/b.remitbak", "b")

  await adapter.delete("remit-backups/2026/10/a.remitbak")

  expect(await readdir(path.join(rootDir, "remit-backups", "2026", "10"))).toEqual(["b.remitbak"])
})

test("never removes the backup directory itself", async () => {
  const adapter = buildLocalAdapter()
  await putText("top-level.remitbak", "archive")

  await adapter.delete("top-level.remitbak")

  expect(await readdir(rootDir)).toEqual([])
})
