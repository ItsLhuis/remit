import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

import { afterEach, describe, expect, test } from "vitest"

import { envSchema } from "@/lib/config/envSchema"

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url))

// Long enough for `docker compose config` on a cold Docker Desktop, which is the slow step here.
const COMPOSE_TIMEOUT_MS = 60_000

const checkouts: string[] = []

function makeCheckout(): string {
  const checkout = mkdtempSync(join(tmpdir(), "remit-install-"))

  cpSync(join(repoRoot, "scripts", "host"), join(checkout, "scripts", "host"), { recursive: true })
  cpSync(join(repoRoot, "deploy"), join(checkout, "deploy"), { recursive: true })
  cpSync(join(repoRoot, "docker-compose.yml"), join(checkout, "docker-compose.yml"))

  checkouts.push(checkout)

  return checkout
}

function withPathPrefix(directory: string): Record<string, string | undefined> {
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH"

  return { [pathKey]: `${directory}${delimiter}${process.env[pathKey] ?? ""}` }
}

// Standard input is an empty pipe, never a terminal, which is exactly what configuration management
// and CI hand the installer.
function runInstaller(
  checkout: string,
  args: string[],
  environment: Record<string, string | undefined> = {}
): SpawnSyncReturns<string> {
  return spawnSync("bash", ["scripts/host/install.sh", ...args], {
    cwd: checkout,
    encoding: "utf8",
    input: "",
    env: { ...process.env, REMIT_INSTALL_ENCRYPTION_KEY: "", ...environment }
  })
}

function unattended(url: string, ...extra: string[]): string[] {
  return ["--yes", "--env-only", "--accept-key-custody", "--url", url, ...extra]
}

function readEnvFile(checkout: string): Record<string, string | undefined> {
  return parseEnv(readFileSync(join(checkout, ".env"), "utf8"))
}

function hashEnvFile(checkout: string): string {
  return createHash("sha256")
    .update(readFileSync(join(checkout, ".env")))
    .digest("hex")
}

// What the containers receive is `.env` after Compose has interpolated it into each service, not the
// file itself, so that rendering is what gets validated — through the same schema the app boots with.
function renderComposeConfig(checkout: string): {
  services: Record<string, { environment?: Record<string, string> }>
} {
  const result = spawnSync("docker", ["compose", "config", "--format", "json"], {
    cwd: checkout,
    encoding: "utf8"
  })

  if (result.status !== 0) {
    throw new Error(`docker compose config failed: ${result.stderr || String(result.error)}`)
  }

  return JSON.parse(result.stdout) as {
    services: Record<string, { environment?: Record<string, string> }>
  }
}

function makeDockerStub(checkout: string): { binDirectory: string; markerFile: string } {
  const binDirectory = join(checkout, "stub-bin")
  const markerFile = join(checkout, "docker-was-called")

  mkdirSync(binDirectory)

  writeFileSync(
    join(binDirectory, "docker"),
    `#!/usr/bin/env bash\necho "$*" >> "${markerFile.replace(/\\/g, "/")}"\nexit 1\n`,
    { mode: 0o755, flag: "w" }
  )

  return { binDirectory, markerFile }
}

afterEach(() => {
  for (const checkout of checkouts.splice(0)) {
    rmSync(checkout, { recursive: true, force: true })
  }
})

describe("install.sh interface", () => {
  test("prints its usage and exits 0 for --help", () => {
    const result = runInstaller(makeCheckout(), ["--help"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Usage: bash scripts/host/install.sh")
  })

  test("refuses an unknown option with the usage exit code", () => {
    const result = runInstaller(makeCheckout(), ["--force"])

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("unknown option: --force")
  })

  test("refuses to start an interview when there is no terminal to ask on", () => {
    const checkout = makeCheckout()

    const result = runInstaller(checkout, [])

    expect(result.status).toBe(2)
    expect(existsSync(join(checkout, ".env"))).toBe(false)
  })

  test("prints every command and runs none of them in a dry run", () => {
    const checkout = makeCheckout()
    const { binDirectory, markerFile } = makeDockerStub(checkout)

    const result = runInstaller(checkout, ["--dry-run", "--proxy"], withPathPrefix(binDirectory))

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("dry run: docker compose pull")
    expect(result.stdout).toContain("dry run: docker compose up -d --no-build")
    expect(result.stdout).toContain("dry run: check nothing listens on 127.0.0.1:443")
    expect(existsSync(markerFile)).toBe(false)
    expect(existsSync(join(checkout, ".env"))).toBe(false)
  })
})

describe("install.sh configuration", () => {
  test(
    "writes an .env the application accepts, as Compose hands it to the app and the worker",
    () => {
      const checkout = makeCheckout()

      const result = runInstaller(checkout, unattended("http://localhost:3000"))
      const rendered = renderComposeConfig(checkout)

      expect(result.status).toBe(0)
      expect(envSchema.safeParse(rendered.services.app?.environment).success).toBe(true)
      expect(envSchema.safeParse(rendered.services.worker?.environment).success).toBe(true)
      expect(rendered.services.caddy).toBeUndefined()
    },
    COMPOSE_TIMEOUT_MS
  )

  test(
    "puts the app behind Caddy on loopback when the proxy is chosen",
    () => {
      const checkout = makeCheckout()

      const result = runInstaller(
        checkout,
        unattended("https://remit.example.com", "--proxy", "--acme-email", "ops@example.com")
      )
      const rendered = renderComposeConfig(checkout)
      const written = readEnvFile(checkout)

      expect(result.status).toBe(0)
      expect(envSchema.safeParse(rendered.services.app?.environment).success).toBe(true)
      expect(rendered.services.caddy?.environment).toMatchObject({
        REMIT_PUBLIC_URL: "https://remit.example.com",
        REMIT_ACME_EMAIL: "ops@example.com"
      })
      expect(written.COMPOSE_PROFILES).toBe("with-proxy")
      expect(written.REMIT_APP_BIND).toBe("127.0.0.1")
    },
    COMPOSE_TIMEOUT_MS
  )

  test("generates every secret afresh for each installation", () => {
    const first = makeCheckout()
    const second = makeCheckout()

    runInstaller(first, unattended("http://localhost:3000"))
    runInstaller(second, unattended("http://localhost:3000"))

    const firstEnv = readEnvFile(first)
    const secondEnv = readEnvFile(second)

    for (const name of [
      "POSTGRES_PASSWORD",
      "BETTER_AUTH_SECRET",
      "MINIO_ROOT_PASSWORD",
      "REMIT_ENCRYPTION_KEY"
    ]) {
      expect(firstEnv[name]).toBeTruthy()
      expect(firstEnv[name]).not.toBe(secondEnv[name])
    }
  })

  test("installs with an encryption key supplied through the environment", () => {
    const checkout = makeCheckout()
    const suppliedKey = Buffer.alloc(32, 7).toString("base64")

    const result = runInstaller(
      checkout,
      ["--yes", "--env-only", "--url", "http://localhost:3000"],
      {
        REMIT_INSTALL_ENCRYPTION_KEY: suppliedKey
      }
    )

    expect(result.status).toBe(0)
    expect(readEnvFile(checkout).REMIT_ENCRYPTION_KEY).toBe(suppliedKey)
  })

  // POSIX permission bits do not exist on NTFS, so this can only be observed where the installer
  // actually runs in production; CI runs it on Linux.
  test("writes .env readable and writable by its owner only", () => {
    const checkout = makeCheckout()

    runInstaller(checkout, unattended("http://localhost:3000"))

    if (process.platform === "win32") return

    expect(statSync(join(checkout, ".env")).mode & 0o777).toBe(0o600)
  })
})

describe("install.sh encryption key custody", () => {
  // The regression this file exists to catch. A second run that generated a new key would make every
  // encrypted column and every backup archive on the instance unreadable, so the whole file must be
  // byte-for-byte what the first run wrote, whatever the second run is asked to do.
  test("never changes .env or its REMIT_ENCRYPTION_KEY when it runs again", () => {
    const checkout = makeCheckout()

    runInstaller(checkout, unattended("http://localhost:3000"))

    const before = hashEnvFile(checkout)

    const rerun = runInstaller(checkout, unattended("https://other.example.com", "--allow-http"))
    const rerunWithSuppliedKey = runInstaller(checkout, unattended("http://localhost:3000"), {
      REMIT_INSTALL_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64")
    })

    expect(rerun.status).toBe(0)
    expect(rerunWithSuppliedKey.status).toBe(0)
    expect(hashEnvFile(checkout)).toBe(before)
  })

  test("refuses an existing .env that has no encryption key and leaves it untouched", () => {
    const checkout = makeCheckout()
    const envPath = join(checkout, ".env")

    writeFileSync(envPath, "REMIT_PUBLIC_URL=http://localhost:3000\nREMIT_ENCRYPTION_KEY=\n")

    const before = hashEnvFile(checkout)
    const result = runInstaller(checkout, unattended("http://localhost:3000"))

    expect(result.status).toBe(1)
    expect(hashEnvFile(checkout)).toBe(before)
  })

  test("refuses to generate a key unattended unless custody is accepted explicitly", () => {
    const checkout = makeCheckout()

    const result = runInstaller(checkout, ["--yes", "--env-only", "--url", "http://localhost:3000"])

    expect(result.status).toBe(2)
    expect(existsSync(join(checkout, ".env"))).toBe(false)
  })

  test("never prints the generated key when it runs unattended", () => {
    const checkout = makeCheckout()

    const result = runInstaller(checkout, unattended("http://localhost:3000"))
    const key = readEnvFile(checkout).REMIT_ENCRYPTION_KEY ?? ""

    expect(key).not.toBe("")
    expect(result.stdout).not.toContain(key)
    expect(result.stderr).not.toContain(key)
  })
})

describe("install.sh public URL", () => {
  test.each([
    ["a trailing slash", "https://remit.example.com/"],
    ["a path", "https://remit.example.com/remit"],
    ["an uppercase host", "https://Remit.example.com"],
    ["the default port", "https://remit.example.com:443"],
    ["a scheme other than http or https", "ftp://remit.example.com"],
    ["no scheme", "remit.example.com"]
  ])("refuses a URL with %s before writing anything", (_shape, url) => {
    const checkout = makeCheckout()

    const result = runInstaller(checkout, unattended(url))

    expect(result.status).toBe(2)
    expect(existsSync(join(checkout, ".env"))).toBe(false)
  })

  test("refuses the proxy for a URL Caddy cannot obtain a certificate for", () => {
    const checkout = makeCheckout()

    const result = runInstaller(
      checkout,
      unattended("http://localhost:3000", "--proxy", "--acme-email", "ops@example.com")
    )

    expect(result.status).toBe(2)
    expect(existsSync(join(checkout, ".env"))).toBe(false)
  })

  test("refuses plain HTTP to a remote host unless it is accepted explicitly", () => {
    const refused = makeCheckout()
    const accepted = makeCheckout()

    const refusal = runInstaller(refused, unattended("http://remit.lan:3000"))
    const acceptance = runInstaller(accepted, unattended("http://remit.lan:3000", "--allow-http"))

    expect(refusal.status).toBe(2)
    expect(acceptance.status).toBe(0)
  })
})
