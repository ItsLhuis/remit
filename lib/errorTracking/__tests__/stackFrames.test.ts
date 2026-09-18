import { describe, expect, test } from "vitest"

import { parseStackFrames } from "../stackFrames"

function errorWithStack(message: string, frames: string[]): Error {
  const error = new Error(message)

  Object.defineProperty(error, "stack", {
    value: [`Error: ${message}`, ...frames].join("\n")
  })

  return error
}

describe("parseStackFrames", () => {
  test("orders frames oldest first and makes paths relative to the working directory", () => {
    const error = errorWithStack("boom", [
      "    at createInvoice (/app/.next/server/chunks/features_invoices_0-59q4h._.js:1:2345)",
      "    at async handler (/app/.next/server/app/(dashboard)/invoices/page.js:3:40)"
    ])

    const frames = parseStackFrames(error, "/app")

    expect(frames).toEqual([
      {
        filename: ".next/server/app/(dashboard)/invoices/page.js",
        function: "async handler",
        lineno: 3,
        colno: 40,
        in_app: true
      },
      {
        filename: ".next/server/chunks/features_invoices_0-59q4h._.js",
        function: "createInvoice",
        lineno: 1,
        colno: 2345,
        in_app: true
      }
    ])
  })

  test("reads an awaited anonymous frame's location without taking async for part of the path", () => {
    const error = errorWithStack("boom", [
      "    at async S:\\Code\\remit\\.next\\server\\chunk.js:28:43267"
    ])

    const frames = parseStackFrames(error, "S:\\Code\\remit")

    expect(frames).toEqual([
      { filename: ".next/server/chunk.js", lineno: 28, colno: 43267, in_app: true }
    ])
  })

  test("keeps Node built-ins and marks dependencies as outside the application", () => {
    const error = errorWithStack("boom", [
      "    at Pool.query (/app/node_modules/postgres/src/connection.js:10:5)",
      "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)"
    ])

    const frames = parseStackFrames(error, "/app")

    expect(frames.map(({ filename, in_app }) => ({ filename, in_app }))).toEqual([
      { filename: "node:internal/process/task_queues", in_app: false },
      { filename: "node_modules/postgres/src/connection.js", in_app: false }
    ])
  })

  test("reduces a path outside the working directory to its file name", () => {
    const error = errorWithStack("boom", [
      "    at run (C:\\Users\\jane.doe\\scratch\\tool.js:4:2)",
      "    at load (file:///home/jane.doe/scratch/loader.mjs:7:9)"
    ])

    const frames = parseStackFrames(error, "S:\\Code\\remit")

    expect(frames.map((frame) => frame.filename)).toEqual(["loader.mjs", "tool.js"])
    expect(JSON.stringify(frames)).not.toContain("jane.doe")
  })

  test("reads Windows and file URL paths inside the working directory", () => {
    const error = errorWithStack("boom", [
      "    at main (S:\\Code\\remit\\scripts\\dist\\worker.js:12:3)",
      "    at file:///S:/Code/remit/scripts/dist/worker.js:40:1"
    ])

    const frames = parseStackFrames(error, "S:\\Code\\remit")

    expect(frames.map((frame) => frame.filename)).toEqual([
      "scripts/dist/worker.js",
      "scripts/dist/worker.js"
    ])
    expect(frames[0].function).toBeUndefined()
  })

  test("skips frames with no position and drops names or locations it cannot vouch for", () => {
    const error = errorWithStack("boom", [
      "    at Array.map (<anonymous>)",
      "    at eval (eval at compile (/app/lib/template.js:1:1), <anonymous>:1:1)",
      "    at Object.<anonymous> (/app/lib/run.js:2:2)",
      "    at jane@example.com (/app/lib/run.js:3:3)"
    ])

    const frames = parseStackFrames(error, "/app")

    expect(frames).toEqual([
      { filename: "lib/run.js", lineno: 3, colno: 3, in_app: true },
      { filename: "lib/run.js", function: "Object.<anonymous>", lineno: 2, colno: 2, in_app: true }
    ])
  })

  test("keeps at most the fifty newest frames", () => {
    const lines = Array.from(
      { length: 80 },
      (_, index) => `    at frame${index} (/app/lib/deep.js:${index + 1}:1)`
    )

    const frames = parseStackFrames(errorWithStack("boom", lines), "/app")

    expect(frames).toHaveLength(50)
    expect(frames.at(-1)?.function).toBe("frame0")
  })

  test("returns no frames when the error has no stack", () => {
    const error = new Error("boom")

    Object.defineProperty(error, "stack", { value: undefined })

    expect(parseStackFrames(error, "/app")).toEqual([])
  })
})
