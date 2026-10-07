import { afterEach, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({ spawn: vi.fn(() => ({ pid: 1 })) }))

vi.mock("node:child_process", () => ({ spawn: mocks.spawn }))

const originalPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform })
}

afterEach(() => {
  setPlatform(originalPlatform)

  vi.clearAllMocks()
})

test("spawns the tool directly with its argument array off Windows", async () => {
  setPlatform("linux")
  const { spawnPostgresTool } = await import("../process")

  spawnPostgresTool("pg_dump", ["--format=custom"], { stdio: "pipe" })

  expect(mocks.spawn).toHaveBeenCalledWith("pg_dump", ["--format=custom"], { stdio: "pipe" })
})

test("hands the Windows shell one joined command line and no argument array", async () => {
  setPlatform("win32")
  const { spawnPostgresTool } = await import("../process")

  spawnPostgresTool("pg_restore", ["--clean", "--dbname=postgresql://"], { stdio: "pipe" })

  expect(mocks.spawn).toHaveBeenCalledWith("pg_restore --clean --dbname=postgresql://", {
    stdio: "pipe",
    shell: true
  })
})

test.each(["postgresql://user:pa ss@host/db", "a&b", 'say "hi"', "x|y"])(
  "refuses to pass %s through the Windows shell",
  async (argument) => {
    setPlatform("win32")
    const { spawnPostgresTool } = await import("../process")

    expect(() => spawnPostgresTool("pg_restore", [argument], {})).toThrow("non-static argument")
    expect(mocks.spawn).not.toHaveBeenCalled()
  }
)
