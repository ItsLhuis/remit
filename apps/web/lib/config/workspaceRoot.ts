import { existsSync } from "node:fs"
import path from "node:path"

// The `.env` the application reads in development sits at the workspace root, beside the Compose
// files that read it too, not in `apps/web`. A built image carries no `pnpm-workspace.yaml`, so
// there the search falls back to the starting directory and finds no `.env`, as before.
export function findWorkspaceRoot(from: string = process.cwd()): string {
  const start = path.resolve(from)
  let directory = start

  while (!existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(directory)

    if (parent === directory) return start

    directory = parent
  }

  return directory
}
