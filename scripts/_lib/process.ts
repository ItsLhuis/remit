import { type ChildProcess } from "node:child_process"

export async function waitForProcess(child: ChildProcess): Promise<number> {
  return await new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("close", (code) => resolve(code ?? 1))
  })
}
