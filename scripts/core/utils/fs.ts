import { stat } from "node:fs/promises"
import path from "node:path"

export function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  )
}

export async function pathExists(filePath: string): Promise<boolean> {
  if (!filePath) return false

  try {
    await stat(filePath)
    return true
  } catch (error) {
    return !isMissingPathError(error)
  }
}

export function isSameOrChildPath(value: string, parent: string): boolean {
  const relative = path.relative(parent, value)

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}
