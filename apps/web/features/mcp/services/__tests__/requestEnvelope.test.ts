import { expect, test } from "vitest"

import { readCalledToolName } from "../requestEnvelope"

test("names the tool a tools/call request asks for", () => {
  const body = {
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "list_invoices", arguments: { statuses: ["overdue"] } }
  }

  expect(readCalledToolName(body)).toBe("list_invoices")
})

test("names no tool for any other method", () => {
  expect(readCalledToolName({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })).toBeNull()
  expect(readCalledToolName({ jsonrpc: "2.0", id: 1, method: "initialize" })).toBeNull()
})

test("names no tool for a body that is not a single well-formed call", () => {
  expect(readCalledToolName(undefined)).toBeNull()
  expect(readCalledToolName("tools/call")).toBeNull()
  expect(readCalledToolName({ method: "tools/call", params: { name: 42 } })).toBeNull()
  expect(
    readCalledToolName([{ method: "tools/call", params: { name: "list_clients" } }])
  ).toBeNull()
})
