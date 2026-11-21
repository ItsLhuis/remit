import { expect, test } from "vitest"

import { activityEntityTypeLabelKeys } from "../labels"
import { ACTIVITY_ENTITY_TYPES } from "../schemas"

// The feed's type filter renders one option per entity type from this same list, so a type with no
// label would reach the select as a blank row rather than failing anywhere a reader would notice.
test("labels every entity type the filter can offer", () => {
  for (const entityType of ACTIVITY_ENTITY_TYPES) {
    expect(activityEntityTypeLabelKeys[entityType]).toMatch(/^activity\.entityTypes\./)
  }
})
