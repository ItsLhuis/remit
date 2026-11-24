import { createRequire, registerHooks } from "node:module"
import { pathToFileURL } from "node:url"

// Preloaded with `node --import` ahead of the worker bundle, because the bundle's imports are
// resolved before any of its own code runs. The bundle inlines the `@remit/web` modules and leaves
// their dependencies external, like the web bundles do, but those dependencies are declared by
// `@remit/web` and installed beside it, so Node cannot find them from `apps/worker`. A bare
// specifier the bundle imports that is not found from the bundle is resolved again from the web
// package: the same files the web process loads, with no second declaration of each dependency to
// keep in step.
//
// Only the bundle's own imports are retried, and only when the package was not found. A dependency
// that probes for an optional package of its own must still see it missing rather than be handed a
// copy `@remit/web` happens to declare, and any other resolution failure is not this hook's to
// paper over. When the web package cannot find it either, the original error is rethrown, because
// it names the real importer; any other failure of the retry is rethrown as it is, because the web
// package found the dependency and that failure is the real one.
//
// A `require()` is answered through `createRequire`, because Node's CommonJS resolver resolves from
// the requiring module itself and ignores a replaced `parentURL`.
const webPackageUrl = import.meta.resolve("@remit/web/package.json")
const requireFromWeb = createRequire(webPackageUrl)

// This file is built beside the worker bundle, into apps/worker/dist/ (apps/worker/tsup.config.ts).
const bundleDirectoryUrl = new URL("./", import.meta.url).href

const MODULE_NOT_FOUND_CODES = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"])

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      const isRetried =
        isBundleImport(context.parentURL) && isBareSpecifier(specifier) && isModuleNotFound(error)

      if (!isRetried) throw error

      try {
        if (context.conditions.includes("require")) {
          return { url: pathToFileURL(requireFromWeb.resolve(specifier)).href, shortCircuit: true }
        }

        return nextResolve(specifier, { ...context, parentURL: webPackageUrl })
      } catch (retryError) {
        throw isModuleNotFound(retryError) ? error : retryError
      }
    }
  }
})

function isBundleImport(parentUrl: string | undefined): boolean {
  return parentUrl?.startsWith(bundleDirectoryUrl) ?? false
}

function isBareSpecifier(specifier: string): boolean {
  return !/^(\.{0,2}\/|[a-z][a-z\d+.-]*:)/i.test(specifier)
}

function isModuleNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    MODULE_NOT_FOUND_CODES.has(error.code)
  )
}
