import { expect, test } from "vitest"

import { getClientHealth } from "../clientHealth"

test("returns owing when the client has an outstanding balance", () => {
  const health = getClientHealth({ outstandingBalanceCents: 5000, invoiceCount: 2 })

  expect(health).toBe("owing")
})

test("returns settled when the balance is cleared but invoices exist", () => {
  const health = getClientHealth({ outstandingBalanceCents: 0, invoiceCount: 3 })

  expect(health).toBe("settled")
})

test("returns dormant when there is no balance and no invoices", () => {
  const health = getClientHealth({ outstandingBalanceCents: 0, invoiceCount: 0 })

  expect(health).toBe("dormant")
})
