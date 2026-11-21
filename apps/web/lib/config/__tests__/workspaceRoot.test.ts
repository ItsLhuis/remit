import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { findWorkspaceRoot } from "../workspaceRoot"

let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), "remit-workspace-root-"))
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe("findWorkspaceRoot", () => {
  test("returns the nearest ancestor holding pnpm-workspace.yaml", () => {
    const app = path.join(sandbox, "apps", "web")

    mkdirSync(app, { recursive: true })
    writeFileSync(path.join(sandbox, "pnpm-workspace.yaml"), "packages: []\n")

    expect(findWorkspaceRoot(app)).toBe(sandbox)
  })

  test("returns the starting directory when no ancestor is a workspace", () => {
    const app = path.join(sandbox, "app", "apps", "web")

    mkdirSync(app, { recursive: true })

    expect(findWorkspaceRoot(app)).toBe(app)
  })
})
