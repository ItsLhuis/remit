import { expect, test, vi } from "vitest"

// The contracts schema reaches `@/features/templates` only for `blocksSchema`; the barrel also
// re-exports the editor components, which pull the server auth config into a unit test. Substituting
// the feature's own schema module keeps the real `blocksSchema` without that graph.
vi.mock("@/features/templates", async () => await vi.importActual("@/features/templates/schemas"))

const { contractFormSchema, createContractSchema, updateContractSchema } =
  await import("../schemas")

const PROJECT_ID = "00000000-0000-4000-8000-000000000001"
const CONTRACT_ID = "00000000-0000-4000-8000-000000000002"

const formInput = {
  title: "Master services agreement",
  projectId: PROJECT_ID,
  clientId: "",
  templateId: "",
  blocks: [],
  effectiveFrom: "2026-01-01",
  effectiveUntil: ""
}

// Contracts are the one form whose schemas are deliberately split: contractFormSchema owns the
// string shape the controls hold and transforms it into the nullable uuids and Dates
// createContractSchema expects. That is why ContractForm resolves WITHOUT `raw: true`, unlike every
// other document form — flipping it here would send "" where a uuid is required.
test("accepts the values ContractForm submits when creating", () => {
  const parsed = contractFormSchema.parse(formInput)

  expect(createContractSchema.safeParse(parsed).success).toBe(true)
})

test("accepts the values ContractForm submits when editing", () => {
  const parsed = contractFormSchema.parse(formInput)

  expect(updateContractSchema.safeParse({ ...parsed, id: CONTRACT_ID }).success).toBe(true)
})

test("rejects the raw control values, which is why the form schema keeps its transform", () => {
  expect(createContractSchema.safeParse(formInput).success).toBe(false)
})
