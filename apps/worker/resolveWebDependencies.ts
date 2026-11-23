import { createRequire, registerHooks } from "node:module"
import { pathToFileURL } from "node:url"

// Preloaded with `node --import` ahead of the worker bundle, because the bundle's imports are
// resolved before any of its own code runs. The bundle inlines the `@remit/web` modules and leaves
// their dependencies external, like the web bundles do, but those dependencies are declared by
// `@remit/web` and installed beside it, so Node cannot find them from `apps/worker`. A bare
// specifier that fails to resolve from the bundle is resolved again from the web package: the same
// files the web process loads, with no second declaration of each dependency to keep in step.
//
// A `require()` is answered through `createRequire`, because Node's CommonJS resolver resolves from
// the requiring module itself and ignores a replaced `parentURL`.
const webPackageUrl = import.meta.resolve("@remit/web/package.json")
const requireFromWeb = createRequire(webPackageUrl)

function isBareSpecifier(specifier: string): boolean {
  return !/^(\.{0,2}\/|[a-z][a-z\d+.-]*:)/i.test(specifier)
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (!isBareSpecifier(specifier)) throw error

      if (context.conditions.includes("require")) {
        return { url: pathToFileURL(requireFromWeb.resolve(specifier)).href, shortCircuit: true }
      }

      return nextResolve(specifier, { ...context, parentURL: webPackageUrl })
    }
  }
})
