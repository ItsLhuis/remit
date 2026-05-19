import { createReadStream } from "node:fs"
import { opendir, stat } from "node:fs/promises"
import path from "node:path"

export type LocalStorageObject = {
  absolutePath: string
  key: string
  size: number
}

export type ListLocalStorageObjectsOptions = {
  rootDir?: string
  skipDir?: string
}

export function resolveLocalUploadsDirectory(
  dataDir: string = process.env.REMIT_DATA_DIR ?? "data"
): string {
  return path.resolve(process.env.REMIT_UPLOADS_DIR ?? path.join(dataDir, "uploads"))
}

export async function listLocalStorageObjects(
  options: ListLocalStorageObjectsOptions = {}
): Promise<LocalStorageObject[]> {
  const rootDir = path.resolve(options.rootDir ?? resolveLocalUploadsDirectory())

  try {
    const stats = await stat(rootDir)

    if (!stats.isDirectory()) return []
  } catch (error) {
    if (isMissingPathError(error)) return []

    throw error
  }

  const skipDir = options.skipDir ? path.resolve(options.skipDir) : null
  const files: LocalStorageObject[] = []

  await collectLocalStorageObjects(rootDir, rootDir, skipDir, files)

  return files.sort((a, b) => a.key.localeCompare(b.key))
}

export function createLocalStorageReadStream(object: LocalStorageObject) {
  return createReadStream(object.absolutePath)
}

async function collectLocalStorageObjects(
  rootDir: string,
  currentDir: string,
  skipDir: string | null,
  files: LocalStorageObject[]
): Promise<void> {
  if (skipDir && isSameOrChildPath(currentDir, skipDir)) return

  const directory = await opendir(currentDir)

  for await (const entry of directory) {
    const absolutePath = path.join(currentDir, entry.name)

    if (skipDir && isSameOrChildPath(absolutePath, skipDir)) continue

    if (entry.isDirectory()) {
      await collectLocalStorageObjects(rootDir, absolutePath, skipDir, files)
      continue
    }

    if (!entry.isFile()) continue

    const stats = await stat(absolutePath)
    const key = path.relative(rootDir, absolutePath).split(path.sep).join("/")

    files.push({ absolutePath, key, size: stats.size })
  }
}

function isSameOrChildPath(value: string, parent: string): boolean {
  const relative = path.relative(parent, value)

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  )
}
