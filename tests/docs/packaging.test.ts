// @vitest-environment node

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

// Bundled and copied into the image, but not operator commands: `docker-entrypoint.sh` runs the
// migrator before the web server and the worker image's `ENTRYPOINT` runs the worker. Listed rather
// than derived, because the list is the guard.
const PROCESS_BUNDLES = ["migrate", "worker"]

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8").replaceAll("\r\n", "\n")
}

function scriptKeys(): Record<string, string> {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> }

  return Object.fromEntries(
    Object.entries(pkg.scripts)
      .filter(([key]) => key.startsWith("remit:"))
      .map(([key, command]) => [key.slice("remit:".length), command])
  )
}

function tsupEntries(): Record<string, string> {
  const source = read("tsup.scripts.config.ts")
  const block = /entry:\s*\{([^}]*)\}/.exec(source)?.[1] ?? ""

  return Object.fromEntries(
    [...block.matchAll(/"?([\w-]+)"?:\s*"([^"]+)"/g)].map((match) => [match[1], match[2]])
  )
}

function copiedBundles(): string[] {
  return [
    ...read("Dockerfile").matchAll(
      /^COPY --from=builder \S+ \/app\/scripts\/dist\/([\w-]+)\.js \.\/scripts\/dist\/\1\.js$/gm
    )
  ].map((match) => match[1])
}

describe("operational command packaging", () => {
  test("each remit:* script runs the bundle named after it", () => {
    const wrong = Object.entries(scriptKeys())
      .filter(([name, command]) => command !== `node ./scripts/dist/${name}.js`)
      .map(([name]) => name)

    expect(wrong).toEqual([])
  })

  test("each tsup entry is scripts/<name>.ts and that file exists", () => {
    const wrong = Object.entries(tsupEntries())
      .filter(([name, file]) => file !== `scripts/${name}.ts` || !existsSync(join(repoRoot, file)))
      .map(([name]) => name)

    expect(wrong).toEqual([])
  })

  test("the tsup entries are the remit:* commands plus the process bundles", () => {
    const expected = [...Object.keys(scriptKeys()), ...PROCESS_BUNDLES].sort()

    expect(Object.keys(tsupEntries()).sort()).toEqual(expected)
  })

  test("the runtime image copies exactly the bundles tsup builds", () => {
    expect(copiedBundles().sort()).toEqual(Object.keys(tsupEntries()).sort())
  })
})
