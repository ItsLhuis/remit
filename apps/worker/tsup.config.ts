import { readFileSync } from "node:fs"

import { defineConfig, type Options } from "tsup"

type EsbuildPlugin = NonNullable<Options["esbuildPlugins"]>[number]

const webPackage = JSON.parse(
  readFileSync(new URL("../web/package.json", import.meta.url), "utf8")
) as { dependencies: Record<string, string> }

const webDependencies = new Set(Object.keys(webPackage.dependencies))

function packageName(specifier: string): string {
  const segments = specifier.split("/")

  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0]
}

// The `@remit/web` modules are inlined and their dependencies stay external, as in the web bundles
// (apps/web/tsup.scripts.config.ts), and resolve at run time through resolveWebDependencies.ts.
// They are not the worker's own dependencies, so tsup would inline them; this plugin keeps them
// out.
// A bare `next/<subpath>` is emitted as `next/<subpath>.js` for the reason the web config gives:
// `next` has no exports map, and plain Node's ESM loader resolves the subpath only with its file.
const externalWebDependencies: EsbuildPlugin = {
  name: "external-web-dependencies",
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, ({ path }) => {
      const name = packageName(path)

      if (!webDependencies.has(name)) return undefined

      return { path: name === "next" && path !== "next" ? `${path}.js` : path, external: true }
    })
  }
}

export default defineConfig({
  entry: {
    resolveWebDependencies: "resolveWebDependencies.ts",
    worker: "worker.ts"
  },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node26",
  clean: true,
  dts: false,
  sourcemap: false,
  splitting: false,
  noExternal: ["@remit/web"],
  esbuildPlugins: [externalWebDependencies]
})
