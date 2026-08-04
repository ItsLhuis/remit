import { createHash } from "node:crypto"
import { chmod, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PassThrough } from "node:stream"
import { gzipSync } from "node:zlib"

import { afterEach, expect, test } from "vitest"

import { auditLogs, settings } from "@/database/schema"

import { database } from "@/tests/integration/database"

import {
  ARCHIVE_HEADER_LENGTH,
  computeKeyFingerprint,
  encryptStream,
  writeArchiveHeader
} from "../../archive/header"
import { buildBackupManifest, serializeBackupManifest, sha256Hex } from "../../backup/manifest"
import { startS3TestServer } from "../../destination/testing/s3TestServer"

const originalPath = process.env.PATH
const originalUploadsDir = process.env.REMIT_UPLOADS_DIR
const originalAllowUnattendedRestore = process.env.REMIT_ALLOW_UNATTENDED_RESTORE
const key = Buffer.from("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "base64")
const databaseUrl = "postgresql://remit_test:remit_test@localhost:5433/remit_test"
const tempRoots: string[] = []
const testBucket = "remit-test"

afterEach(async () => {
  process.env.PATH = originalPath

  if (originalUploadsDir) {
    process.env.REMIT_UPLOADS_DIR = originalUploadsDir
  } else {
    delete process.env.REMIT_UPLOADS_DIR
  }

  if (originalAllowUnattendedRestore) {
    process.env.REMIT_ALLOW_UNATTENDED_RESTORE = originalAllowUnattendedRestore
  } else {
    delete process.env.REMIT_ALLOW_UNATTENDED_RESTORE
  }

  await Promise.all(
    tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true, force: true }))
  )
})

test("restores a local backup archive and records restore audit events", async () => {
  const tempRoot = await makeTempDirectory()
  const uploadsDir = path.join(tempRoot, "uploads")
  const archivePath = path.join(tempRoot, "backups", "roundtrip.remitbak")
  const shimDir = path.join(tempRoot, "bin")
  await mkdir(path.join(uploadsDir, "client-files"), { recursive: true })
  await mkdir(shimDir, { recursive: true })
  await writeFile(path.join(uploadsDir, "client-files", "invoice.pdf"), "archived upload")
  await writePgToolShims(shimDir)

  process.env.PATH = `${shimDir}${path.delimiter}${originalPath ?? ""}`
  process.env.REMIT_UPLOADS_DIR = uploadsDir

  await database.insert(settings).values({ businessName: "Archived business" })

  const { runBackup } = await import("../../backup/runBackup")
  const schema = await import("@/database/schema")
  await runBackup(database, schema, {
    databaseUrl,
    destinationOverride: "local",
    dryRun: false,
    encryptionKey: key,
    help: false,
    output: archivePath,
    remitDataDir: tempRoot,
    skipStatusUpdate: true,
    yes: true
  })

  await database.update(settings).set({ businessName: "Changed business" })
  await writeFile(path.join(uploadsDir, "client-files", "invoice.pdf"), "changed upload")

  const result = await runRestoreCli(archivePath, tempRoot, uploadsDir, shimDir, ["--yes"])

  const [settingsRow] = await database.select().from(settings)
  const auditRows = await database
    .select({ event: auditLogs.event, metadata: auditLogs.metadata })
    .from(auditLogs)
  const backupFiles = await readdir(path.join(tempRoot, "backups"))

  expect(result.exitCode, result.output).toBe(0)
  expect(settingsRow?.businessName).toBe("Archived business")
  await expect(
    readFile(path.join(uploadsDir, "client-files", "invoice.pdf"), "utf8")
  ).resolves.toBe("archived upload")
  expect(backupFiles.some((file) => file.endsWith(".pre-restore.remitbak"))).toBe(true)
  expect(auditRows.map((row) => row.event)).toEqual(
    expect.arrayContaining([
      "instance.restore.started",
      "instance.restore.snapshot_taken",
      "instance.restore.completed"
    ])
  )
})

test("refuses a tampered local backup archive before applying live data", async () => {
  const tempRoot = await makeTempDirectory()
  const uploadsDir = path.join(tempRoot, "uploads")
  const archivePath = path.join(tempRoot, "backups", "tampered.remitbak")
  const shimDir = path.join(tempRoot, "bin")
  await mkdir(uploadsDir, { recursive: true })
  await mkdir(shimDir, { recursive: true })
  await writePgToolShims(shimDir)

  process.env.PATH = `${shimDir}${path.delimiter}${originalPath ?? ""}`
  process.env.REMIT_UPLOADS_DIR = uploadsDir

  await database.insert(settings).values({ businessName: "Archived business" })

  const { runBackup } = await import("../../backup/runBackup")
  const schema = await import("@/database/schema")
  await runBackup(database, schema, {
    databaseUrl,
    destinationOverride: "local",
    dryRun: false,
    encryptionKey: key,
    help: false,
    output: archivePath,
    remitDataDir: tempRoot,
    skipStatusUpdate: true,
    yes: true
  })

  const archive = await readFile(archivePath)
  archive[archive.length - 1] ^= 1
  await writeFile(archivePath, archive)
  await database.update(settings).set({ businessName: "Changed business" })

  const result = await runRestoreCli(archivePath, tempRoot, uploadsDir, shimDir, ["--yes"])
  const [settingsRow] = await database.select().from(settings)

  expect(result.exitCode).toBe(1)
  expect(result.output).toContain("archive failed integrity check")
  expect(settingsRow?.businessName).toBe("Changed business")
})

test("refuses a local archive created by a newer app version", async () => {
  const tempRoot = await makeTempDirectory()
  const uploadsDir = path.join(tempRoot, "uploads")
  const shimDir = path.join(tempRoot, "bin")
  const archivePath = path.join(tempRoot, "newer.remitbak")
  await mkdir(uploadsDir, { recursive: true })
  await mkdir(shimDir, { recursive: true })
  await writeFile(archivePath, await buildMinimalArchive({ appVersion: "9.0.0" }))

  const result = await runRestoreCli(archivePath, tempRoot, uploadsDir, shimDir, ["--dry-run"])

  expect(result.exitCode).toBe(1)
  expect(result.output).toContain("upgrade the running build")
})

test("restores a remote backup archive from a remit URI", async () => {
  const tempRoot = await makeTempDirectory()
  const uploadsDir = path.join(tempRoot, "uploads")
  const shimDir = path.join(tempRoot, "bin")
  await mkdir(path.join(uploadsDir, "client-files"), { recursive: true })
  await mkdir(shimDir, { recursive: true })
  await writeFile(path.join(uploadsDir, "client-files", "invoice.pdf"), "remote archived upload")
  await writePgToolShims(shimDir)
  const s3 = await startS3TestServer()

  try {
    process.env.PATH = `${shimDir}${path.delimiter}${originalPath ?? ""}`
    process.env.REMIT_UPLOADS_DIR = uploadsDir

    await database.insert(settings).values({
      backupDestination: "s3",
      backupS3AccessKey: "test-access-key",
      backupS3Bucket: testBucket,
      backupS3Endpoint: s3.endpoint,
      backupS3Region: "us-east-1",
      backupS3SecretKey: "test-secret-key",
      businessName: "Remote archived business"
    })

    const { runBackup } = await import("../../backup/runBackup")
    const schema = await import("@/database/schema")
    const backup = await runBackup(database, schema, {
      databaseUrl,
      dryRun: false,
      encryptionKey: key,
      help: false,
      output: null,
      remitDataDir: tempRoot,
      skipStatusUpdate: true,
      yes: true
    })

    await database.update(settings).set({ businessName: "Changed business" })
    await writeFile(path.join(uploadsDir, "client-files", "invoice.pdf"), "changed upload")

    const result = await runRestoreCli(backup.archivePath, tempRoot, uploadsDir, shimDir, ["--yes"])

    const [settingsRow] = await database.select().from(settings)

    expect(result.exitCode, result.output).toBe(0)
    expect(settingsRow?.businessName).toBe("Remote archived business")
    await expect(
      readFile(path.join(uploadsDir, "client-files", "invoice.pdf"), "utf8")
    ).resolves.toBe("remote archived upload")
  } finally {
    await s3.close()
  }
})

async function runRestoreCli(
  archivePath: string,
  remitDataDir: string,
  uploadsDir: string,
  shimDir: string,
  args: string[]
): Promise<{ exitCode: number; output: string }> {
  const { spawn } = await import("node:child_process")
  const scriptPath = path.join(process.cwd(), "scripts", "restore.ts")
  const child = spawn(process.execPath, ["--import", "tsx", scriptPath, archivePath, ...args], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PATH: `${shimDir}${path.delimiter}${originalPath ?? ""}`,
      REMIT_ALLOW_UNATTENDED_RESTORE: "1",
      REMIT_DATA_DIR: remitDataDir,
      REMIT_UPLOADS_DIR: uploadsDir
    },
    stdio: ["ignore", "pipe", "pipe"]
  })
  let output = ""

  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => {
    output += chunk
  })
  child.stderr.on("data", (chunk: string) => {
    output += chunk
  })

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject)
    child.once("close", (code) => resolve(code ?? 1))
  })

  return { exitCode, output }
}

async function writePgToolShims(directory: string): Promise<void> {
  if (process.platform === "win32") {
    await writeFile(
      path.join(directory, "pg_dump.cmd"),
      [
        "@echo off",
        "docker compose -f docker-compose.test.yml exec -T -e PGPASSWORD=remit_test database_test pg_dump -U remit_test -d remit_test %*"
      ].join("\r\n")
    )
    await writeFile(
      path.join(directory, "pg_restore.cmd"),
      [
        "@echo off",
        "setlocal enabledelayedexpansion",
        "set ARGS=",
        ":loop",
        'if "%~1"=="" goto run',
        'if "%~1"=="--dbname" (',
        "  shift",
        "  shift",
        "  goto loop",
        ")",
        "set ARGS=!ARGS! %1",
        "shift",
        "goto loop",
        ":run",
        "docker compose -f docker-compose.test.yml exec -T -e PGPASSWORD=remit_test database_test pg_restore -U remit_test -d remit_test %ARGS%"
      ].join("\r\n")
    )
    return
  }

  const pgDumpPath = path.join(directory, "pg_dump")
  const pgRestorePath = path.join(directory, "pg_restore")
  await writeFile(
    pgDumpPath,
    [
      "#!/usr/bin/env sh",
      'docker compose -f docker-compose.test.yml exec -T -e PGPASSWORD=remit_test database_test pg_dump -U remit_test -d remit_test "$@"'
    ].join("\n")
  )
  await writeFile(
    pgRestorePath,
    [
      "#!/usr/bin/env sh",
      'ARGS=""',
      'while [ "$#" -gt 0 ]; do',
      '  if [ "$1" = "--dbname" ]; then',
      "    shift",
      "    shift",
      "    continue",
      "  fi",
      '  case "$1" in',
      "    --dbname=*) shift; continue ;;",
      "  esac",
      '  ARGS="$ARGS \\"$1\\""',
      "  shift",
      "done",
      'eval "docker compose -f docker-compose.test.yml exec -T -e PGPASSWORD=remit_test database_test pg_restore -U remit_test -d remit_test $ARGS"'
    ].join("\n")
  )
  await chmod(pgDumpPath, 0o755)
  await chmod(pgRestorePath, 0o755)
}

async function buildMinimalArchive(options: { appVersion: string }): Promise<Buffer> {
  const databaseDump = Buffer.from("database dump")
  const checksums = Buffer.from(`${sha256(databaseDump)}  database/remit.dump\n`, "utf8")
  const manifest = buildBackupManifest({
    appVersion: options.appVersion,
    checksumsSha256: sha256Hex(checksums),
    components: {
      database: {
        size: databaseDump.length,
        sha256: sha256(databaseDump)
      },
      uploads: {
        fileCount: 0,
        totalSize: 0
      }
    },
    createdAt: "2026-05-20T12:00:00.000Z",
    destination: "local",
    encryptionKey: key,
    schemaMigrationId: "0001_initial"
  })
  const tar = Buffer.concat([
    tarFile("manifest.json", serializeBackupManifest(manifest)),
    tarFile("checksums.sha256", checksums),
    tarFile("database/remit.dump", databaseDump),
    Buffer.alloc(1024)
  ])
  const iv = Buffer.from("123456789012")
  const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
  writeArchiveHeader(header, { iv, keyFingerprint: computeKeyFingerprint(key) })
  const encrypted = await encryptBuffer(gzipSync(tar), iv)

  return Buffer.concat([header, encrypted.ciphertext, encrypted.authTag])
}

async function encryptBuffer(
  plaintext: Buffer,
  iv: Buffer
): Promise<{ authTag: Buffer; ciphertext: Buffer }> {
  const encryption = encryptStream(key, iv)
  const chunks: Buffer[] = []

  for await (const chunk of PassThrough.from(plaintext).pipe(encryption.stream)) {
    chunks.push(Buffer.from(chunk))
  }

  return {
    authTag: encryption.getAuthTag(),
    ciphertext: Buffer.concat(chunks)
  }
}

function tarFile(name: string, content: Buffer): Buffer {
  return Buffer.concat([
    tarHeader(name, content.length),
    content,
    Buffer.alloc(paddingFor(content.length))
  ])
}

function tarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512)
  writeAscii(header, name, 0, 100)
  writeOctal(header, 0o644, 100, 8)
  writeOctal(header, 0, 108, 8)
  writeOctal(header, 0, 116, 8)
  writeOctal(header, size, 124, 12)
  writeOctal(header, 0, 136, 12)
  header.fill(0x20, 148, 156)
  header.write("0", 156, 1, "ascii")
  header.write("ustar\0", 257, 6, "ascii")
  header.write("00", 263, 2, "ascii")
  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  writeOctal(header, checksum, 148, 8)

  return header
}

function writeAscii(buffer: Buffer, value: string, offset: number, length: number): void {
  Buffer.from(value, "utf8").copy(buffer, offset, 0, length)
}

function writeOctal(buffer: Buffer, value: number, offset: number, length: number): void {
  const field = `${value.toString(8).padStart(length - 2, "0")}\0 `
  buffer.write(field, offset, length, "ascii")
}

function paddingFor(size: number): number {
  const remainder = size % 512

  return remainder === 0 ? 0 : 512 - remainder
}

async function makeTempDirectory(): Promise<string> {
  const tempRoot = await import("node:fs/promises").then((fs) =>
    fs.mkdtemp(path.join(os.tmpdir(), "remit-restore-"))
  )
  tempRoots.push(tempRoot)

  return tempRoot
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex")
}
