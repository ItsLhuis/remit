// @vitest-environment node

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

// Bundled and copied into the image, but not an operator command: `docker-entrypoint.sh` runs the
// migrator before the web server. Listed rather than derived, because the list is the guard.
const PROCESS_BUNDLES = ["migrate"]

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8").replaceAll("\r\n", "\n")
}

function packageScripts(path: string): Record<string, string> {
  return (JSON.parse(read(path)) as { scripts: Record<string, string> }).scripts
}

function scriptKeys(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(packageScripts("apps/web/package.json"))
      .filter(([key]) => key.startsWith("remit:"))
      .map(([key, command]) => [key.slice("remit:".length), command])
  )
}

function tsupEntries(configPath: string): Record<string, string> {
  const source = read(configPath)
  const block = /entry:\s*\{([^}]*)\}/.exec(source)?.[1] ?? ""

  return Object.fromEntries(
    [...block.matchAll(/"?([\w-]+)"?:\s*"([^"]+)"/g)].map((match) => [match[1], match[2]])
  )
}

function webTsupEntries(): Record<string, string> {
  return tsupEntries("apps/web/tsup.scripts.config.ts")
}

function workerTsupEntries(): Record<string, string> {
  return tsupEntries("apps/worker/tsup.config.ts")
}

function copiedBundles(pattern: RegExp): string[] {
  return [...read("Dockerfile").matchAll(pattern)].map((match) => match[1])
}

function copiedWebBundles(): string[] {
  return copiedBundles(
    /^COPY --from=builder \S+ \/app\/apps\/web\/scripts\/dist\/([\w-]+)\.js \.\/scripts\/dist\/\1\.js$/gm
  )
}

function copiedWorkerBundles(): string[] {
  return copiedBundles(
    /^COPY --from=builder \S+ \/app\/apps\/worker\/dist\/([\w-]+)\.js \.\/dist\/\1\.js$/gm
  )
}

// The `worker` stage is the last one in the Dockerfile, so its `ENTRYPOINT` is the last one.
function workerEntrypoint(): string {
  const entrypoints = [...read("Dockerfile").matchAll(/^ENTRYPOINT (\[.*\])$/gm)]
  const command = JSON.parse(entrypoints.at(-1)?.[1] ?? "[]") as string[]

  return command.join(" ")
}

describe("operational command packaging", () => {
  test("each remit:* script runs the bundle named after it", () => {
    const wrong = Object.entries(scriptKeys())
      .filter(([name, command]) => command !== `node ./scripts/dist/${name}.js`)
      .map(([name]) => name)

    expect(wrong).toEqual([])
  })

  test("each tsup entry is scripts/<name>.ts and that file exists", () => {
    const wrong = Object.entries(webTsupEntries())
      .filter(
        ([name, file]) =>
          file !== `scripts/${name}.ts` || !existsSync(join(repoRoot, "apps", "web", file))
      )
      .map(([name]) => name)

    expect(wrong).toEqual([])
  })

  test("the tsup entries are the remit:* commands plus the process bundles", () => {
    const expected = [...Object.keys(scriptKeys()), ...PROCESS_BUNDLES].sort()

    expect(Object.keys(webTsupEntries()).sort()).toEqual(expected)
  })

  test("the runtime image copies exactly the bundles tsup builds", () => {
    expect(copiedWebBundles().sort()).toEqual(Object.keys(webTsupEntries()).sort())
  })
})

describe("worker packaging", () => {
  test("each worker tsup entry is <name>.ts and that file exists", () => {
    const wrong = Object.entries(workerTsupEntries())
      .filter(
        ([name, file]) =>
          file !== `${name}.ts` || !existsSync(join(repoRoot, "apps", "worker", file))
      )
      .map(([name]) => name)

    expect(wrong).toEqual([])
  })

  test("the worker image copies exactly the bundles the worker builds", () => {
    expect(copiedWorkerBundles().sort()).toEqual(Object.keys(workerTsupEntries()).sort())
  })

  // The worker bundle cannot resolve the web dependencies without its resolver preloaded, so the
  // image and `pnpm start:worker` have to start it the same way.
  test("the worker image runs the command pnpm start:worker runs", () => {
    expect(workerEntrypoint()).toBe(packageScripts("apps/worker/package.json").start)
  })
})
