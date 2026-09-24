import { expect, test } from "vitest"

import { type ProjectDetail } from "../../types"
import { toProjectFormData } from "../toProjectFormData"

function makeProject(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: "project-1",
    name: "Brand refresh",
    clientId: "client-1",
    clientName: "Acme",
    status: "active",
    currency: "EUR",
    budgetCents: 1_250_050,
    hourlyRateCents: 9_500,
    startDate: new Date(Date.UTC(2026, 2, 9)),
    endDate: new Date(Date.UTC(2026, 5, 30)),
    description: "Logo, type and colour system",
    deletedAt: null,
    createdAt: new Date(Date.UTC(2026, 2, 1)),
    updatedAt: new Date(Date.UTC(2026, 2, 1)),
    ...overrides
  }
}

test("fills the form with money as decimal input strings and dates as calendar days", () => {
  const formData = toProjectFormData(makeProject())

  expect(formData).toEqual({
    id: "project-1",
    clientId: "client-1",
    name: "Brand refresh",
    budget: "12500.50",
    hourlyRate: "95.00",
    startDate: "2026-03-09",
    endDate: "2026-06-30",
    description: "Logo, type and colour system"
  })
})

test("leaves an unset budget, rate and dates blank rather than zero", () => {
  const formData = toProjectFormData(
    makeProject({ budgetCents: null, hourlyRateCents: null, startDate: null, endDate: null })
  )

  expect(formData.budget).toBe("")
  expect(formData.hourlyRate).toBe("")
  expect(formData.startDate).toBe("")
  expect(formData.endDate).toBe("")
})
