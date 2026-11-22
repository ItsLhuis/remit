import { existsSync } from "node:fs"
import path from "node:path"

// The `.env` the application reads in development sits at the workspace root, beside the Compose
// files that read it too, not in `apps/web`. A built image carries no `pnpm-workspace.yaml`, so
// there the search falls back to the starting directory and finds no `.env`.
export function findWorkspaceRoot(from: string = process.cwd()): string {
  // `lib/config/env.ts` puts this walk in the server bundle, and Turbopack reads a path built from
  // a runtime value as a possible read of any file, tracing the whole project into the standalone
  // output. The annotations tell it these paths are runtime-only.
  const start = path.resolve(/* turbopackIgnore: true */ from)
  let directory = start

  while (!existsSync(/* turbopackIgnore: true */ path.join(directory, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(directory)

    if (parent === directory) return start

    directory = parent
  }

  return directory
}
