import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, describe, expect, test, vi } from "vitest"

// Every case runs the real `upgrade.sh` through `bash`, and the full runs also start both helper
// scripts it calls; on Windows each of those is another MSYS process, which under a parallel suite
// outlasts the default five-second budget on process creation alone, as `install.test.ts` measured.
vi.setConfig({ testTimeout: 20_000 })

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url))

const BACKUP_COMMAND = "compose exec -T app pnpm remit:backup --yes"
const PULL_COMMAND = "compose pull"
const RESTART_COMMAND = "compose up -d"
const HEALTH_COMMAND = "compose ps -q app"

const PREVIOUS_ARCHIVE = "/app/data/backups/remit-previous.remitbak"
const NEW_ARCHIVE = "/app/data/backups/remit-new.remitbak"

type Checkout = {
  directory: string
  binDirectory: string
  commandLog: string
}

const checkouts: string[] = []

// A `docker` that records every invocation and answers each one the script makes the way a healthy
// host with a running stack would. The backup command appends a new archive to the archive list the
// in-container `ls` reads, which is what lets the script tell a fresh snapshot from an older one.
// `STUB_FAIL` names one invocation that exits non-zero instead.
function makeCheckout(): Checkout {
  const directory = mkdtempSync(join(tmpdir(), "remit-upgrade-"))
  const binDirectory = join(directory, "stub-bin")
  const commandLog = join(directory, "docker-commands.log")
  const archiveList = join(directory, "archives.txt")

  cpSync(join(repoRoot, "scripts", "host"), join(directory, "scripts", "host"), { recursive: true })
  cpSync(join(repoRoot, "docker-compose.yml"), join(directory, "docker-compose.yml"))
  mkdirSync(binDirectory)

  writeFileSync(archiveList, `${PREVIOUS_ARCHIVE}\n`)
  writeFileSync(
    join(binDirectory, "docker"),
    [
      "#!/usr/bin/env bash",
      `log="${toPosixPath(commandLog)}"`,
      `archives="${toPosixPath(archiveList)}"`,
      'printf "%s\\n" "$*" >> "$log"',
      'if [ -n "${STUB_FAIL:-}" ] && [ "$*" = "$STUB_FAIL" ]; then exit 3; fi',
      'case "$*" in',
      '  "--version") echo "Docker version 27.3.1, build ce12230" ;;',
      '  "compose version") echo "Docker Compose version v2.29.7" ;;',
      '  "compose ps --services --status running app") printf "%s\\n" "${STUB_RUNNING_SERVICES-app}" ;;',
      '  "compose exec -T app sh -lc "*) tail -n 1 "$archives" ;;',
      `  "${BACKUP_COMMAND}") echo "${NEW_ARCHIVE}" >> "$archives" ;;`,
      `  "${HEALTH_COMMAND}") echo "0123456789ab" ;;`,
      '  "inspect "*) echo "healthy|running" ;;',
      "esac",
      "exit 0",
      ""
    ].join("\n"),
    { mode: 0o755 }
  )

  checkouts.push(directory)

  return { directory, binDirectory, commandLog }
}

function toPosixPath(path: string): string {
  return path.replace(/\\/g, "/")
}

function runUpgrade(
  checkout: Checkout,
  args: string[],
  environment: Record<string, string> = {}
): SpawnSyncReturns<string> {
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH"

  return spawnSync("bash", ["scripts/host/upgrade.sh", ...args], {
    cwd: checkout.directory,
    encoding: "utf8",
    input: "",
    env: {
      ...process.env,
      [pathKey]: `${checkout.binDirectory}${delimiter}${process.env[pathKey] ?? ""}`,
      REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP: "",
      ...environment
    }
  })
}

function readCommands(checkout: Checkout): string[] {
  if (!existsSync(checkout.commandLog)) return []

  return readFileSync(checkout.commandLog, "utf8").split("\n").filter(Boolean)
}

// Only the steps that change the instance, in the order they ran.
function readUpgradeSteps(checkout: Checkout): string[] {
  const steps = [BACKUP_COMMAND, PULL_COMMAND, RESTART_COMMAND, HEALTH_COMMAND]

  return readCommands(checkout).filter((command) => steps.includes(command))
}

afterEach(() => {
  for (const directory of checkouts.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("upgrade.sh interface", () => {
  test("prints its usage and exits 0 for --help", () => {
    const result = runUpgrade(makeCheckout(), ["--help"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Usage: bash scripts/host/upgrade.sh")
  })

  test("refuses an unknown option with the usage exit code and runs nothing", () => {
    const checkout = makeCheckout()

    const result = runUpgrade(checkout, ["--force"])

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("unknown option: --force")
    expect(readCommands(checkout)).toEqual([])
  })

  test("refuses to skip the backup unless the environment opts in as well", () => {
    const checkout = makeCheckout()

    const result = runUpgrade(checkout, ["--skip-backup"])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("refusing --skip-backup")
    expect(readCommands(checkout)).toEqual([])
  })
})

describe("upgrade.sh dry run", () => {
  test("prints the backup, pull, restart and health steps in order and runs none of them", () => {
    const checkout = makeCheckout()

    const result = runUpgrade(checkout, ["--dry-run"])

    const plan = [
      `dry run: docker ${BACKUP_COMMAND}`,
      `dry run: docker ${PULL_COMMAND}`,
      `dry run: docker ${RESTART_COMMAND}`,
      "dry run: ./scripts/host/_wait-for-health.sh"
    ].map((line) => result.stdout.indexOf(line))

    expect(result.status).toBe(0)
    expect(plan.every((position) => position >= 0)).toBe(true)
    expect(plan).toEqual(plan.toSorted((left, right) => left - right))
    expect(readCommands(checkout)).toEqual([])
  })
})

describe("upgrade.sh run", () => {
  // `up -d` is the step that migrates: it recreates `app`, whose docker-entrypoint.sh applies pending
  // migrations before the server starts. So "backup before pull, pull before migrate" is this order.
  test("backs up before pulling and pulls before restarting, then waits for health", () => {
    const checkout = makeCheckout()

    const result = runUpgrade(checkout, [])

    expect(result.status).toBe(0)
    expect(readUpgradeSteps(checkout)).toEqual([
      BACKUP_COMMAND,
      PULL_COMMAND,
      RESTART_COMMAND,
      HEALTH_COMMAND
    ])
    expect(result.stdout).toContain(`backup snapshot: ${NEW_ARCHIVE}`)
  })

  test("upgrades without a backup only when both opt-ins are given", () => {
    const checkout = makeCheckout()

    const result = runUpgrade(checkout, ["--skip-backup"], {
      REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP: "1"
    })

    expect(result.status).toBe(0)
    expect(readUpgradeSteps(checkout)).toEqual([PULL_COMMAND, RESTART_COMMAND, HEALTH_COMMAND])
  })

  test("stops before pulling any image when the backup fails, and says nothing changed", () => {
    const checkout = makeCheckout()

    const result = runUpgrade(checkout, [], { STUB_FAIL: BACKUP_COMMAND })

    expect(result.status).toBe(3)
    expect(readUpgradeSteps(checkout)).toEqual([BACKUP_COMMAND])
    expect(result.stderr).toContain("nothing was changed")
    expect(result.stderr).not.toContain("rollback guidance")
  })

  test("stops before restarting when the pull fails and names the new backup to restore", () => {
    const checkout = makeCheckout()

    const result = runUpgrade(checkout, [], { STUB_FAIL: PULL_COMMAND })

    expect(result.status).toBe(3)
    expect(readUpgradeSteps(checkout)).toEqual([BACKUP_COMMAND, PULL_COMMAND])
    expect(result.stderr).toContain(`pnpm remit:restore "${NEW_ARCHIVE}"`)
  })

  test("refuses to upgrade a stack whose app service is not running", () => {
    const checkout = makeCheckout()

    const result = runUpgrade(checkout, [], { STUB_RUNNING_SERVICES: "" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("app service is not running")
    expect(readUpgradeSteps(checkout)).toEqual([])
  })
})
