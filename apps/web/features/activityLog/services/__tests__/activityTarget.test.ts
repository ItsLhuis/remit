import { describe, expect, test } from "vitest"

import { ACTIVITY_ENTITY_TYPES } from "../../schemas"
import { resolveActivityTarget, type ActivityRecordState } from "../activityTarget"

const ID = "8f14e45f-ea5c-4f3a-9e2b-1d0c7a6b5e40"

const LIVE: ActivityRecordState = {
  deletedAt: null,
  projectId: null,
  invoiceId: null,
  invoiceProjectId: null
}

const OWNER = { canOpenTrash: true }

describe("a live record", () => {
  test("links every entity type to its record or the list that shows it", () => {
    const hrefs = Object.fromEntries(
      ACTIVITY_ENTITY_TYPES.map((entityType) => [
        entityType,
        resolveActivityTarget(entityType, ID, LIVE, OWNER)
      ])
    )

    expect(hrefs).toEqual({
      client: { state: "live", href: `/clients/${ID}` },
      lead: { state: "live", href: `/leads/${ID}` },
      project: { state: "live", href: `/projects/${ID}` },
      proposal: { state: "live", href: `/proposals/${ID}` },
      invoice: { state: "live", href: "/invoices" },
      contract: { state: "live", href: `/contracts/${ID}` },
      credit_note: { state: "live", href: "/credit-notes" },
      recurring_invoice: { state: "live", href: `/recurring-invoices/${ID}` },
      time_entry: { state: "live", href: "/time" },
      expense: { state: "live", href: "/expenses" },
      payment: { state: "live", href: "/invoices" }
    })
  })

  test("opens a credit note itself, under its invoice's project", () => {
    const target = resolveActivityTarget(
      "credit_note",
      ID,
      { ...LIVE, invoiceId: "inv", invoiceProjectId: "proj" },
      OWNER
    )

    expect(target).toEqual({
      state: "live",
      href: `/projects/proj/invoices/inv/credit-notes/${ID}`
    })
  })

  test("opens an invoice and a payment's invoice under the project", () => {
    expect(resolveActivityTarget("invoice", ID, { ...LIVE, projectId: "proj" }, OWNER)).toEqual({
      state: "live",
      href: `/projects/proj/invoices/${ID}`
    })
    expect(
      resolveActivityTarget(
        "payment",
        ID,
        { ...LIVE, invoiceId: "inv", invoiceProjectId: "proj" },
        OWNER
      )
    ).toEqual({ state: "live", href: "/projects/proj/invoices/inv" })
  })
})

describe("a record that is no longer live", () => {
  test("points a deleted record at its place in the trash", () => {
    const target = resolveActivityTarget(
      "credit_note",
      ID,
      { ...LIVE, deletedAt: new Date("2026-06-01T00:00:00.000Z") },
      OWNER
    )

    expect(target).toEqual({
      state: "trashed",
      href: `/settings/data?trash_kind=creditNote&trash_record=${ID}#trash`
    })
  })

  test("offers no trash link to a role that cannot open the trash", () => {
    const target = resolveActivityTarget(
      "invoice",
      ID,
      { ...LIVE, deletedAt: new Date("2026-06-01T00:00:00.000Z") },
      { canOpenTrash: false }
    )

    expect(target).toEqual({ state: "trashed", href: null })
  })

  test("says a record with no row left was removed for good", () => {
    expect(resolveActivityTarget("client", ID, undefined, OWNER)).toEqual({ state: "gone" })
  })
})
