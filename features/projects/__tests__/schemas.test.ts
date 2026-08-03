import { expect, test } from "vitest"

import {
  createProjectSchema,
  projectFormSchema,
  updateProjectSchema,
  type ProjectFormInputValues
} from "../schemas"

const CLIENT_ID = "00000000-0000-4000-8000-000000000001"
const PROJECT_ID = "00000000-0000-4000-8000-000000000002"

// What ProjectForm holds in its controls, empty optional money and date fields included: those
// empty strings are the path the transform turns into `null`, which is exactly what a re-parse
// built from the string-input shape rejects.
const formInput: ProjectFormInputValues = {
  clientId: CLIENT_ID,
  name: "Marketing site",
  budget: "",
  hourlyRate: "75.00",
  startDate: "2026-01-01",
  endDate: "",
  description: ""
}

// ProjectForm resolves with `raw: true`, so these are the values that travel to the server action.
// Without it the form would send the schema's transformed cents and Dates, and every one of these
// re-parses would fail with "expected string, received number".
test("accepts the values ProjectForm submits when creating", () => {
  const result = createProjectSchema.safeParse(formInput)

  expect(result.success).toBe(true)
})

test("accepts the values ProjectForm submits when editing", () => {
  const result = updateProjectSchema.safeParse({ ...formInput, id: PROJECT_ID })

  expect(result.success).toBe(true)
})

test("parses empty optional money and date fields to null rather than rejecting them", () => {
  const result = projectFormSchema.safeParse(formInput)

  expect(result).toEqual({
    success: true,
    data: expect.objectContaining({ budget: null, endDate: null, hourlyRate: 7500 })
  })
})
