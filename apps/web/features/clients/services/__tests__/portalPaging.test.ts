import { expect, test } from "vitest"

import { resolvePortalPage } from "../portalPaging"

test("starts at the first page", () => {
  expect(resolvePortalPage(1, 25)).toEqual({ page: 1, pageCount: 3, offset: 0 })
})

test("offsets a later page by whole pages", () => {
  expect(resolvePortalPage(3, 25)).toEqual({ page: 3, pageCount: 3, offset: 20 })
})

test("lands on the last page when asked for one past the end", () => {
  expect(resolvePortalPage(9, 25)).toEqual({ page: 3, pageCount: 3, offset: 20 })
})

test("has one empty page when there is nothing to list", () => {
  expect(resolvePortalPage(4, 0)).toEqual({ page: 1, pageCount: 1, offset: 0 })
})
