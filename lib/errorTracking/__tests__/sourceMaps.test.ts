import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import { buildErrorEvent, type ErrorEventFacts } from "../errorEvent"
import { createSourceMapResolver } from "../sourceMaps"

// esbuild's minified CommonJS output for this source, with its map, exactly as it wrote them:
//
//   export class InvoiceNumberingError extends Error {}
//
//   export function allocateInvoiceNumber(counter: number): number {
//     if (counter < 0) {
//       throw new InvoiceNumberingError("The counter went below zero")
//     }
//
//     return counter + 1
//   }
//
//   export function issueInvoice(counter: number): number {
//     const next = allocateInvoiceNumber(counter)
//
//     return next
//   }
//
// Real minifier output rather than a hand-built map, so the tests meet the shapes a bundler writes:
// a class reduced to an anonymous expression bound to `o`, and an export called as `Object.a`.
const MINIFIED_CHUNK =
  'var u=Object.defineProperty;var x=Object.getOwnPropertyDescriptor;var b=Object.getOwnPropertyNames;var i=Object.prototype.hasOwnProperty;var l=(e,n)=>{for(var r in n)u(e,r,{get:n[r],enumerable:!0})},m=(e,n,r,c)=>{if(n&&typeof n=="object"||typeof n=="function")for(let t of b(n))!i.call(e,t)&&t!==r&&u(e,t,{get:()=>n[t],enumerable:!(c=x(n,t))||c.enumerable});return e};var w=e=>m(u({},"__esModule",{value:!0}),e);var f={};l(f,{InvoiceNumberingError:()=>o,allocateInvoiceNumber:()=>s,issueInvoice:()=>a});module.exports=w(f);var o=class extends Error{};function s(e){if(e<0)throw new o("The counter went below zero");return e+1}function a(e){return s(e)}0&&(module.exports={InvoiceNumberingError,allocateInvoiceNumber,issueInvoice});\n//# sourceMappingURL=chunk.js.map\n'

const MINIFIED_CHUNK_MAP = {
  version: 3,
  sources: ["../src/invoices.ts"],
  mappings:
    "4ZAAA,IAAAA,EAAA,GAAAC,EAAAD,EAAA,2BAAAE,EAAA,0BAAAC,EAAA,iBAAAC,IAAA,eAAAC,EAAAL,GAAO,IAAME,EAAN,cAAoC,KAAM,CAAC,EAE3C,SAASC,EAAsBG,EAAyB,CAC7D,GAAIA,EAAU,EACZ,MAAM,IAAIJ,EAAsB,6BAA6B,EAG/D,OAAOI,EAAU,CACnB,CAEO,SAASF,EAAaE,EAAyB,CAGpD,OAFaH,EAAsBG,CAAO,CAG5C",
  names: [
    "invoices_exports",
    "__export",
    "InvoiceNumberingError",
    "allocateInvoiceNumber",
    "issueInvoice",
    "__toCommonJS",
    "counter"
  ]
}

type MinifiedModule = { issueInvoice: (counter: number) => number }

const roots: string[] = []

// A checkout holding the chunk as `out/chunk.js`, and its map beside it unless `withMap` is false.
function makeRoot(withMap = true): { root: string; load: () => MinifiedModule } {
  const root = mkdtempSync(join(tmpdir(), "remit-source-maps-"))
  const chunkPath = join(root, "out", "chunk.js")

  mkdirSync(join(root, "out"))
  writeFileSync(chunkPath, MINIFIED_CHUNK)

  if (withMap) writeFileSync(`${chunkPath}.map`, JSON.stringify(MINIFIED_CHUNK_MAP))

  roots.push(root)

  return { root, load: () => createRequire(import.meta.url)(chunkPath) as MinifiedModule }
}

function thrownBy(run: () => unknown): Error {
  try {
    run()
  } catch (error) {
    if (error instanceof Error) return error
  }

  throw new Error("Expected the call to throw")
}

function factsFor(root: string): ErrorEventFacts {
  return {
    eventId: "0123456789abcdef0123456789abcdef",
    timestamp: 1_760_000_000,
    release: "1.0.0",
    environment: "production",
    runtime: "server",
    cwd: root
  }
}

function buildFor(error: Error, root: string, withResolver = true) {
  return buildErrorEvent(
    { error, context: { source: "process", phase: "run" } },
    factsFor(root),
    withResolver ? createSourceMapResolver(root) : undefined
  )
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("source-mapped error events", () => {
  test("reports a minified frame at its source file, line and column, under its source name", () => {
    const { root, load } = makeRoot()
    const error = thrownBy(() => load().issueInvoice(-1))

    const frames = buildFor(error, root)?.exception.values[0]?.stacktrace?.frames ?? []

    expect(frames.slice(-2)).toEqual([
      {
        filename: "src/invoices.ts",
        function: "issueInvoice",
        lineno: 12,
        colno: 16,
        in_app: true
      },
      {
        filename: "src/invoices.ts",
        function: "allocateInvoiceNumber",
        lineno: 5,
        colno: 11,
        in_app: true
      }
    ])
  })

  test("reports a minified error class under the name its source gave it", () => {
    const { root, load } = makeRoot()
    const error = thrownBy(() => load().issueInvoice(-1))

    const event = buildFor(error, root)

    expect(event?.exception.values[0]?.type).toBe("InvoiceNumberingError")
  })

  test("leaves frames without a map as they were and never types the error by a minified name", () => {
    const { root, load } = makeRoot(false)
    const error = thrownBy(() => load().issueInvoice(-1))

    const event = buildFor(error, root)
    const chunkFrames = (event?.exception.values[0]?.stacktrace?.frames ?? []).filter(
      (frame) => frame.filename === "out/chunk.js"
    )

    expect(event?.exception.values[0]?.type).toBe("Error")
    expect(chunkFrames.map((frame) => frame.function)).toEqual(["Object.a", "s"])
  })

  test("keeps the class name of an error thrown outside any bundle", () => {
    class LedgerLockError extends Error {}

    const { root } = makeRoot()
    const error = thrownBy(() => {
      throw new LedgerLockError("lock held")
    })

    expect(buildFor(error, root)?.exception.values[0]?.type).toBe("LedgerLockError")
  })

  test("leaves the type as the error names itself when no resolver is given", () => {
    const { root, load } = makeRoot()
    const error = thrownBy(() => load().issueInvoice(-1))

    expect(buildFor(error, root, false)?.exception.values[0]?.type).toBe("Error")
  })

  test("reads nothing outside the working directory, whatever a frame names", () => {
    const { root, load } = makeRoot()
    const elsewhere = makeRoot()
    const error = thrownBy(() => load().issueInvoice(-1))

    const frames = buildFor(error, elsewhere.root)?.exception.values[0]?.stacktrace?.frames ?? []

    expect(frames.some((frame) => frame.filename === "src/invoices.ts")).toBe(false)
    expect(root).not.toBe(elsewhere.root)
  })
})
