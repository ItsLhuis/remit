import { expect, test } from "vitest"

import { activityEntityTypeLabelKeys, getActivityEntityHref } from "../labels"
import { ACTIVITY_ENTITY_TYPES } from "../schemas"

const ENTITY_ID = "8f14e45f-ea5c-4f3a-9e2b-1d0c7a6b5e40"

test("gives every entity type a link target that names the record or its list", () => {
  const targets = ACTIVITY_ENTITY_TYPES.map((entityType) => [
    entityType,
    getActivityEntityHref(entityType, ENTITY_ID)
  ])

  expect(Object.fromEntries(targets)).toEqual({
    client: `/clients/${ENTITY_ID}`,
    lead: `/leads/${ENTITY_ID}`,
    project: `/projects/${ENTITY_ID}`,
    proposal: "/proposals",
    invoice: "/invoices",
    contract: `/contracts/${ENTITY_ID}`,
    credit_note: "/credit-notes",
    recurring_invoice: `/recurring-invoices/${ENTITY_ID}`,
    time_entry: "/time",
    expense: "/expenses",
    payment: "/invoices"
  })
})

// The feed's type filter renders one option per entity type from this same list, so a type with no
// label would reach the select as a blank row rather than failing anywhere a reader would notice.
test("labels every entity type the filter can offer", () => {
  for (const entityType of ACTIVITY_ENTITY_TYPES) {
    expect(activityEntityTypeLabelKeys[entityType]).toMatch(/^activity\.entityTypes\./)
  }
})
