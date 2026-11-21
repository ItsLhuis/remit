import { expect, test } from "vitest"

import {
  createTaskSchema,
  taskFormSchema,
  updateTaskSchema,
  type TaskFormInputValues
} from "../schemas"

const PROJECT_ID = "00000000-0000-4000-8000-000000000001"
const TASK_ID = "00000000-0000-4000-8000-000000000002"

// What TaskForm holds in its controls, empty optional money and date fields included: those empty
// strings are the path the transform turns into `null`, which is exactly what a re-parse built from
// the string-input shape rejects.
const formInput: TaskFormInputValues = {
  title: "Wireframes",
  description: "",
  status: "todo",
  priority: "normal",
  dueDate: "",
  hourlyRate: "75.00"
}

// TaskForm resolves with `raw: true`, so these are the values that travel to the server action.
// Without it the form would send the schema's transformed cents and Dates, and every one of these
// re-parses would fail with "expected string, received number".
test("accepts the values TaskForm submits when creating", () => {
  const result = createTaskSchema.safeParse({ ...formInput, projectId: PROJECT_ID })

  expect(result.success).toBe(true)
})

test("accepts the values TaskForm submits when editing", () => {
  const result = updateTaskSchema.safeParse({ ...formInput, id: TASK_ID })

  expect(result.success).toBe(true)
})

test("parses an empty optional due date to null rather than rejecting it", () => {
  const result = taskFormSchema.safeParse(formInput)

  expect(result).toEqual({
    success: true,
    data: expect.objectContaining({ dueDate: null, hourlyRate: 7500 })
  })
})
