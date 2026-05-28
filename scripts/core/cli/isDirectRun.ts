import path from "node:path"
import { pathToFileURL } from "node:url"

export function isDirectRun(moduleUrl: string): boolean {
  const scriptPath = process.argv[1]
  if (!scriptPath) return false

  return moduleUrl === pathToFileURL(scriptPath).href
}

export function isDirectRunNamed(moduleUrl: string, expectedName: string): boolean {
  const scriptPath = process.argv[1]
  if (!scriptPath) return false

  const scriptName = path.basename(scriptPath, path.extname(scriptPath))

  return scriptName === expectedName && moduleUrl === pathToFileURL(scriptPath).href
}
