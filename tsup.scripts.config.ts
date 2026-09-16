import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { defineConfig } from "tsup"

const OUT_DIR = "scripts/dist"

// Matches a bare `next/<subpath>` specifier in a static `from` or a dynamic `import(` and nothing
// that already names a file.
const BARE_NEXT_SUBPATH = /(from\s*|import\s*\(\s*)(["'])(next\/[a-z-]+(?:\/[a-z-]+)*)\2/g

export default defineConfig({
  entry: {
    backup: "scripts/backup.ts",
    migrate: "scripts/migrate.ts",
    "reset-data": "scripts/reset-data.ts",
    "reset-password": "scripts/reset-password.ts",
    restore: "scripts/restore.ts",
    "rotate-encryption-key": "scripts/rotate-encryption-key.ts",
    "seed-demo": "scripts/seed-demo.ts",
    worker: "scripts/worker.ts"
  },
  outDir: OUT_DIR,
  format: ["esm"],
  platform: "node",
  target: "node24",
  clean: true,
  dts: false,
  sourcemap: false,
  splitting: false,
  // The scripts run under plain Node's ESM loader, which resolves a bare `next/headers` only through
  // a package `exports` map, and `next` has none: the worker died at startup with
  // ERR_MODULE_NOT_FOUND on the first `next/*` import its graph reaches through
  // `lib/auth/session.ts`. Next.js ships each subpath as a CommonJS file at the package root
  // (`next/headers.js`), whose named exports survive Node's CommonJS interop, so the emitted
  // specifiers are given that extension. It is done to the output rather than during resolution
  // because tsup marks dependencies external before an esbuild plugin or alias can rewrite them.
  async onSuccess() {
    const bundles = (await readdir(OUT_DIR)).filter((name) => name.endsWith(".js"))

    await Promise.all(
      bundles.map(async (name) => {
        const bundlePath = path.join(OUT_DIR, name)
        const source = await readFile(bundlePath, "utf8")
        const rewritten = source.replace(
          BARE_NEXT_SUBPATH,
          (_match, prefix: string, quote: string, specifier: string) =>
            `${prefix}${quote}${specifier}.js${quote}`
        )

        if (rewritten !== source) await writeFile(bundlePath, rewritten)
      })
    )
  }
})
