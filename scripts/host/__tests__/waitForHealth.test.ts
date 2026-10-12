import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, expect, test, vi } from "vitest"

// Each case runs the real script through `bash`, which on Windows is several MSYS processes per poll;
// `install.test.ts` measured that outlasting the default budget under a parallel suite.
vi.setConfig({ testTimeout: 20_000 })

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url))

const checkouts: string[] = []

// A `docker` whose `inspect` answers each poll with the next line of `statuses`, repeating the last
// one, and a `sleep` that returns at once, so a sequence of polls costs no wall-clock time.
function makeCheckout(statuses: string[]): { directory: string; binDirectory: string } {
  const directory = mkdtempSync(join(tmpdir(), "remit-health-"))
  const binDirectory = join(directory, "stub-bin")
  const statusFile = join(directory, "statuses.txt").replace(/\\/g, "/")
  const pollFile = join(directory, "polls.txt").replace(/\\/g, "/")

  cpSync(join(repoRoot, "scripts", "host"), join(directory, "scripts", "host"), { recursive: true })
  mkdirSync(binDirectory)

  writeFileSync(statusFile, `${statuses.join("\n")}\n`)
  writeFileSync(
    join(binDirectory, "docker"),
    [
      "#!/usr/bin/env bash",
      'case "$*" in',
      '  "compose ps -q app") echo "0123456789ab" ;;',
      '  "compose logs --tail 50 app") echo "app log line" ;;',
      '  "inspect "*)',
      `    polls=$(cat "${pollFile}" 2>/dev/null || echo 0)`,
      `    echo $((polls + 1)) > "${pollFile}"`,
      `    total=$(wc -l < "${statusFile}")`,
      "    line=$((polls + 1 > total ? total : polls + 1))",
      `    sed -n "\${line}p" "${statusFile}"`,
      "    ;;",
      "esac",
      ""
    ].join("\n"),
    { mode: 0o755 }
  )
  writeFileSync(join(binDirectory, "sleep"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 })

  checkouts.push(directory)

  return { directory, binDirectory }
}

function waitForHealth(
  statuses: string[],
  args: string[] = [],
  environment: Record<string, string> = {}
): SpawnSyncReturns<string> {
  const { directory, binDirectory } = makeCheckout(statuses)
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH"

  return spawnSync("bash", ["scripts/host/_wait-for-health.sh", ...args], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      [pathKey]: `${binDirectory}${delimiter}${process.env[pathKey] ?? ""}`,
      REMIT_HEALTH_TIMEOUT_SECONDS: "",
      ...environment
    }
  })
}

afterEach(() => {
  for (const checkout of checkouts.splice(0)) {
    rmSync(checkout, { recursive: true, force: true })
  }
})

test("waits through an unhealthy report while a slow first start finishes", () => {
  const result = waitForHealth([
    "starting|running|0",
    "unhealthy|running|0",
    "unhealthy|running|0",
    "healthy|running|0"
  ])

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("app service is healthy")
})

test("fails at once when the app container stops while starting", () => {
  const result = waitForHealth(["starting|running|0", "|exited|0"])

  expect(result.status).toBe(1)
  expect(result.stderr).toContain("the app container is exited")
  expect(result.stderr).toContain("app log line")
})

test("fails at once when the app container restarts while starting", () => {
  const result = waitForHealth(["starting|running|0", "starting|running|1"])

  expect(result.status).toBe(1)
  expect(result.stderr).toContain("restarted while starting")
})

test("says how to wait longer and that re-running is safe when the budget runs out", () => {
  const result = waitForHealth(["starting|running|0"], ["--timeout", "1"])

  expect(result.status).toBe(1)
  expect(result.stderr).toContain("timed out after 1s")
  expect(result.stderr).toContain("Running the same")
  expect(result.stderr).toContain("REMIT_HEALTH_TIMEOUT_SECONDS")
})

test("takes its budget from REMIT_HEALTH_TIMEOUT_SECONDS", () => {
  const result = waitForHealth(["healthy|running|0"], [], { REMIT_HEALTH_TIMEOUT_SECONDS: "1200" })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("waiting up to 1200s")
})

test.each([["0"], ["ten"], ["-5"], ["090"]])(
  "refuses %s as a budget with the usage exit code",
  (value) => {
    const result = waitForHealth(["healthy|running|0"], ["--timeout", value])

    expect(result.status).toBe(2)
  }
)
