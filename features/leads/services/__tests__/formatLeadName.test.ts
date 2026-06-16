import { expect, test } from "vitest"

import { formatLeadName } from "../formatLeadName"

test("uses the full name when first and last name are present", () => {
  const name = formatLeadName({
    firstName: "Jane",
    lastName: "Doe",
    company: "Acme",
    email: "jane@example.com"
  })

  expect(name).toBe("Jane Doe")
})

test("falls back to company when no personal name is present", () => {
  const name = formatLeadName({
    firstName: "",
    lastName: "",
    company: "Acme Studio",
    email: "hello@example.com"
  })

  expect(name).toBe("Acme Studio")
})

test("falls back to email when no name or company is present", () => {
  const name = formatLeadName({
    firstName: "  ",
    lastName: "",
    company: " ",
    email: "lead@example.com"
  })

  expect(name).toBe("lead@example.com")
})
