import type { registerHooks } from "node:module"

import { beforeAll, expect, test, vi } from "vitest"

type ResolveHook = NonNullable<Parameters<typeof registerHooks>[0]["resolve"]>
type NextResolve = Parameters<ResolveHook>[2]

const hooks = vi.hoisted(() => ({ resolve: undefined as ResolveHook | undefined }))

vi.mock("node:module", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:module")>()

  return {
    ...actual,
    registerHooks: (options: Parameters<typeof registerHooks>[0]) => {
      hooks.resolve = options.resolve

      return { deregister: () => undefined }
    }
  }
})

const bundleImporterUrl = new URL("../worker.js", import.meta.url).href

let resolve: ResolveHook

beforeAll(async () => {
  await import("../resolveWebDependencies")

  if (!hooks.resolve) throw new Error("resolveWebDependencies.ts registered no resolve hook")

  resolve = hooks.resolve
})

function errorWithCode(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

function resolveWith(webPackageOutcome: () => never): () => unknown {
  const bundleError = errorWithCode("ERR_MODULE_NOT_FOUND", "Cannot find package 'pino'")

  const nextResolve: NextResolve = (_specifier, context) => {
    if (context?.parentURL === bundleImporterUrl) throw bundleError

    return webPackageOutcome()
  }

  return () =>
    resolve(
      "pino",
      { conditions: ["node", "import"], importAttributes: {}, parentURL: bundleImporterUrl },
      nextResolve
    )
}

test("rethrows the web package's own error when it finds the package but cannot resolve it", () => {
  const webPackageError = errorWithCode(
    "ERR_PACKAGE_PATH_NOT_EXPORTED",
    "Package subpath './internal' is not defined by \"exports\""
  )

  const resolvePino = resolveWith(() => {
    throw webPackageError
  })

  expect(resolvePino).toThrow(webPackageError)
})

test("rethrows the bundle's error, naming the real importer, when the web package cannot find the package either", () => {
  const resolvePino = resolveWith(() => {
    throw errorWithCode("ERR_MODULE_NOT_FOUND", "Cannot find package 'pino' imported from web")
  })

  expect(resolvePino).toThrow("Cannot find package 'pino'")
  expect(resolvePino).not.toThrow("imported from web")
})
