import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { makeClient, makeInvoice, makeProject, makeSettings } from "@/tests/factories"

const NOW = new Date("2026-08-02T12:00:00.000Z")

async function makeOverviewFixture() {
  await makeSettings()

  const liveClient = await makeClient({ name: "Live client" })
  const deletedClient = await makeClient({
    name: "Deleted client",
    deletedAt: new Date("2026-06-01T10:00:00.000Z")
  })

  const liveProject = await makeProject({ clientId: liveClient.id, name: "Live project" })
  const deletedProject = await makeProject({
    clientId: liveClient.id,
    name: "Deleted project",
    deletedAt: new Date("2026-06-02T10:00:00.000Z")
  })

  await makeInvoice({ projectId: liveProject.id, number: "INV-LIVE", status: "sent" })
  await makeInvoice({
    projectId: liveProject.id,
    number: "INV-DELETED",
    status: "sent",
    deletedAt: new Date("2026-06-03T10:00:00.000Z")
  })
  await makeInvoice({ projectId: deletedProject.id, number: "INV-DEAD-PROJECT", status: "sent" })
  await makeInvoice({ clientId: deletedClient.id, number: "INV-DEAD-CLIENT", status: "sent" })
  await makeInvoice({ clientId: liveClient.id, number: "INV-CLIENT-ONLY", status: "sent" })

  return { liveClient, liveProject }
}

describe("getInvoiceOverviewPageData", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("lists every invoice that is not itself soft-deleted, whatever became of its parents", async () => {
    await makeOverviewFixture()

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({})

    expect(data.invoices.map((invoice) => invoice.number).sort()).toEqual([
      "INV-CLIENT-ONLY",
      "INV-DEAD-CLIENT",
      "INV-DEAD-PROJECT",
      "INV-LIVE"
    ])
    expect(data.rowCount).toBe(4)
  })

  test("summarizes exactly the population the table pages through", async () => {
    await makeOverviewFixture()

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({})

    expect(data.summary.total).toBe(4)
    expect(data.summary.awaiting).toBe(4)
    expect(data.summary.draft).toBe(0)
  })

  test("carries parent context for an invoice that has only a project", async () => {
    const { liveClient, liveProject } = await makeOverviewFixture()

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({ search: "INV-LIVE" })

    expect(data.invoices[0]).toMatchObject({
      parentLabel: liveProject.name,
      projectId: liveProject.id,
      clientId: liveClient.id,
      clientName: liveClient.name
    })
  })

  test("carries parent context for an invoice that has only a client", async () => {
    const { liveClient } = await makeOverviewFixture()

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({ search: "INV-CLIENT-ONLY" })

    expect(data.invoices[0]).toMatchObject({
      parentLabel: liveClient.name,
      projectId: null,
      clientId: liveClient.id,
      clientName: liveClient.name
    })
  })

  test("prefers the project when an invoice carries both parents", async () => {
    await makeSettings()

    const client = await makeClient({ name: "Both client" })
    const project = await makeProject({ clientId: client.id, name: "Both project" })

    await makeInvoice({ projectId: project.id, clientId: client.id, number: "INV-BOTH" })

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({})

    expect(data.invoices[0]).toMatchObject({
      parentLabel: project.name,
      projectId: project.id,
      clientId: client.id
    })
  })

  test("reports the derived status and the unpaid remainder for each row", async () => {
    await makeSettings()

    const project = await makeProject()

    await makeInvoice({
      projectId: project.id,
      number: "INV-PART",
      status: "sent",
      totalCents: 100000,
      amountPaidCents: 40000,
      dueDate: new Date("2026-08-31T00:00:00.000Z")
    })

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({})

    expect(data.invoices[0]).toMatchObject({
      viewStatus: "partially_paid",
      totalCents: 100000,
      outstandingCents: 60000
    })
  })

  test("filters on the derived overdue status the database does not store", async () => {
    await makeSettings()

    const project = await makeProject()

    await makeInvoice({
      projectId: project.id,
      number: "INV-LATE",
      status: "sent",
      dueDate: new Date("2026-08-01T00:00:00.000Z")
    })
    await makeInvoice({
      projectId: project.id,
      number: "INV-DUE-TODAY",
      status: "sent",
      dueDate: new Date("2026-08-02T00:00:00.000Z")
    })
    await makeInvoice({
      projectId: project.id,
      number: "INV-LATE-DRAFT",
      status: "draft",
      dueDate: new Date("2026-08-01T00:00:00.000Z")
    })

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({ status: "overdue" })

    expect(data.invoices.map((invoice) => invoice.number)).toEqual(["INV-LATE"])
    expect(data.rowCount).toBe(1)
  })

  test("keeps the derived status filter and the row badge in agreement", async () => {
    await makeSettings()

    const project = await makeProject()

    await makeInvoice({
      projectId: project.id,
      number: "INV-PART",
      status: "sent",
      totalCents: 100000,
      amountPaidCents: 40000,
      dueDate: new Date("2026-08-31T00:00:00.000Z")
    })
    await makeInvoice({
      projectId: project.id,
      number: "INV-PART-LATE",
      status: "sent",
      totalCents: 100000,
      amountPaidCents: 40000,
      dueDate: new Date("2026-07-01T00:00:00.000Z")
    })
    await makeInvoice({
      projectId: project.id,
      number: "INV-SENT",
      status: "sent",
      totalCents: 100000,
      dueDate: new Date("2026-08-31T00:00:00.000Z")
    })

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const partial = await getInvoiceOverviewPageData({ status: "partially_paid" })
    const sent = await getInvoiceOverviewPageData({ status: "sent" })

    expect(partial.invoices.map((invoice) => invoice.number)).toEqual(["INV-PART"])
    expect(partial.invoices.every((invoice) => invoice.viewStatus === "partially_paid")).toBe(true)
    expect(sent.invoices.map((invoice) => invoice.number)).toEqual(["INV-SENT"])
  })

  test("orders by the soonest due date and sorts rows without one last", async () => {
    await makeSettings()

    const project = await makeProject()

    await makeInvoice({ projectId: project.id, number: "INV-NONE", dueDate: null })
    await makeInvoice({
      projectId: project.id,
      number: "INV-LATER",
      dueDate: new Date("2026-09-01T00:00:00.000Z")
    })
    await makeInvoice({
      projectId: project.id,
      number: "INV-SOONER",
      dueDate: new Date("2026-08-10T00:00:00.000Z")
    })

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({})

    expect(data.invoices.map((invoice) => invoice.number)).toEqual([
      "INV-SOONER",
      "INV-LATER",
      "INV-NONE"
    ])
  })

  test("narrows to the requested client through either parent link", async () => {
    await makeSettings()

    const targetClient = await makeClient({ name: "Target" })
    const otherClient = await makeClient({ name: "Other" })
    const targetProject = await makeProject({ clientId: targetClient.id })
    const otherProject = await makeProject({ clientId: otherClient.id })

    await makeInvoice({ projectId: targetProject.id, number: "INV-VIA-PROJECT" })
    await makeInvoice({ clientId: targetClient.id, number: "INV-DIRECT" })
    await makeInvoice({ projectId: otherProject.id, number: "INV-OTHER" })

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({ client: targetClient.id })

    expect(data.invoices.map((invoice) => invoice.number).sort()).toEqual([
      "INV-DIRECT",
      "INV-VIA-PROJECT"
    ])
    expect(data.rowCount).toBe(2)
  })

  test("matches the search term against the number, the project, and the client", async () => {
    await makeSettings()

    const client = await makeClient({ name: "Northwind" })
    const project = await makeProject({ clientId: client.id, name: "Rebrand" })

    await makeInvoice({ projectId: project.id, number: "INV-AAA" })

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const byClient = await getInvoiceOverviewPageData({ search: "northwind" })
    const byProject = await getInvoiceOverviewPageData({ search: "rebrand" })
    const byNumber = await getInvoiceOverviewPageData({ search: "AAA" })
    const byNothing = await getInvoiceOverviewPageData({ search: "zzz" })

    expect(byClient.rowCount).toBe(1)
    expect(byProject.rowCount).toBe(1)
    expect(byNumber.rowCount).toBe(1)
    expect(byNothing.rowCount).toBe(0)
  })

  test("offers a filter option for every client reachable from a listed invoice", async () => {
    const { liveClient } = await makeOverviewFixture()

    const { getInvoiceOverviewPageData } = await import("../overviewQueries")

    const data = await getInvoiceOverviewPageData({})

    expect(data.filterOptions.clients.map((client) => client.name)).toEqual([
      "Deleted client",
      liveClient.name
    ])
  })
})
