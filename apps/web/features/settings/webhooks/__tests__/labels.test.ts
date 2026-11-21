import { expect, test } from "vitest"

import { WEBHOOK_EVENTS } from "@/features/webhooks"

import { webhookEventGroups } from "../labels"

test("offers every subscribable event in the add dialog exactly once", () => {
  const offered = webhookEventGroups.flatMap((group) => [...group.events])

  expect(offered.toSorted()).toEqual([...WEBHOOK_EVENTS].toSorted())
  expect(new Set(offered).size).toBe(offered.length)
})
