import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"

import chalk from "chalk"

import { toShippedSourceMap } from "./core/build/serverSourceMaps"

const BUILD_SERVER_DIRECTORY = ".next/server"
const STANDALONE_SERVER_DIRECTORY = ".next/standalone/.next/server"

// Run by the Dockerfile's builder stage after `pnpm build`. Next.js's standalone output traces the
// server chunks the image runs but copies the maps of only a few route entries, so every frame in a
// reported error would point into a minified chunk with nothing beside it to read
// (`lib/errorTracking/sourceMaps.ts`). This puts each chunk's map next to the chunk the standalone
// output kept, with the names its minifier dropped and without the source text
// (`core/build/serverSourceMaps.ts`). A chunk the standalone output did not keep gets no map.
function shipServerSourceMaps(): void {
  if (!existsSync(STANDALONE_SERVER_DIRECTORY)) {
    console.error(chalk.red(`${STANDALONE_SERVER_DIRECTORY} does not exist; run pnpm build first.`))
    process.exit(1)
  }

  const shipped = listMaps(BUILD_SERVER_DIRECTORY).filter(shipMap).length

  console.log(chalk.green(`Shipped ${shipped} server source maps into the standalone output.`))
}

function shipMap(mapPath: string): boolean {
  const target = join(STANDALONE_SERVER_DIRECTORY, relative(BUILD_SERVER_DIRECTORY, mapPath))
  const chunkPath = mapPath.slice(0, -".map".length)

  if (!existsSync(target.slice(0, -".map".length)) || !existsSync(chunkPath)) return false

  const map = toShippedSourceMap(readFileSync(mapPath, "utf8"), readFileSync(chunkPath, "utf8"))

  if (!map) {
    console.error(chalk.red(`${mapPath} is not a source map.`))
    process.exit(1)
  }

  writeFileSync(target, map)

  return true
}

function listMaps(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) return listMaps(path)

    return entry.name.endsWith(".js.map") ? [path] : []
  })
}

shipServerSourceMaps()
