import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process"

// Flags and fixed values only: no space, quote or shell metacharacter can pass.
const STATIC_ARGUMENT = /^[-\w=:/.]+$/

export async function waitForProcess(child: ChildProcess): Promise<number> {
  return await new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("close", (code) => resolve(code ?? 1))
  })
}

// `pg_dump` and `pg_restore` are found through the shell on Windows, because that is the only way a
// `.cmd` shim on PATH resolves — Node will not start one without a shell. Handing a shell an argument
// array is what Node 24 deprecates (DEP0190): the arguments are concatenated, never escaped. So on
// Windows the command line is joined here from arguments that are checked to be static, and the
// connection details travel in the environment rather than on that line. Everywhere else the tool is
// spawned directly and no shell is involved.
export function spawnPostgresTool(
  command: "pg_dump" | "pg_restore",
  args: readonly string[],
  options: SpawnOptions
): ChildProcess {
  if (process.platform !== "win32") return spawn(command, args, options)

  const unsafe = args.find((arg) => !STATIC_ARGUMENT.test(arg))

  if (unsafe !== undefined) {
    throw new Error(`Refusing to pass a non-static argument to ${command} through a shell.`)
  }

  return spawn([command, ...args].join(" "), { ...options, shell: true })
}
