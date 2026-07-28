import { describe, expect, test } from "vitest"

import { makeClient, makeProject, makeProposal, makeSettings } from "@/tests/factories"

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
  const orphanedProject = await makeProject({
    clientId: deletedClient.id,
    name: "Orphaned project"
  })

  await makeProposal({ projectId: liveProject.id, number: "PROP-LIVE", status: "sent" })
  await makeProposal({
    projectId: liveProject.id,
    number: "PROP-DELETED",
    deletedAt: new Date("2026-06-03T10:00:00.000Z")
  })
  await makeProposal({ projectId: deletedProject.id, number: "PROP-DEAD-PROJECT" })
  await makeProposal({ projectId: orphanedProject.id, number: "PROP-DEAD-CLIENT" })

  return { liveClient, liveProject }
}

describe("getProposalOverviewPageData", () => {
  test("lists only proposals whose own record, project, and client are all live", async () => {
    await makeOverviewFixture()

    const { getProposalOverviewPageData } = await import("../queries")

    const data = await getProposalOverviewPageData({})

    expect(data.proposals.map((proposal) => proposal.number)).toEqual(["PROP-LIVE"])
    expect(data.rowCount).toBe(1)
  })

  test("summarizes exactly the population the table pages through", async () => {
    await makeOverviewFixture()

    const { getProposalOverviewPageData } = await import("../queries")

    const data = await getProposalOverviewPageData({})

    expect(data.summary.total).toBe(1)
    expect(data.summary.awaiting).toBe(1)
    expect(data.summary.draft).toBe(0)
  })

  test("offers filter options only for clients that still have a visible proposal", async () => {
    const { liveClient } = await makeOverviewFixture()

    const { getProposalOverviewPageData } = await import("../queries")

    const data = await getProposalOverviewPageData({})

    expect(data.filterOptions.clients).toEqual([{ id: liveClient.id, name: liveClient.name }])
  })

  test("carries the project and client of each row so the list reads out of project scope", async () => {
    const { liveClient, liveProject } = await makeOverviewFixture()

    const { getProposalOverviewPageData } = await import("../queries")

    const [proposal] = (await getProposalOverviewPageData({})).proposals

    expect(proposal).toMatchObject({
      projectId: liveProject.id,
      projectName: liveProject.name,
      clientId: liveClient.id,
      clientName: liveClient.name
    })
  })

  test("orders by the soonest validity window and sorts rows without one last", async () => {
    await makeSettings()

    const project = await makeProject()

    await makeProposal({ projectId: project.id, number: "PROP-NONE", validUntil: null })
    await makeProposal({
      projectId: project.id,
      number: "PROP-LATE",
      validUntil: new Date("2026-09-01T00:00:00.000Z")
    })
    await makeProposal({
      projectId: project.id,
      number: "PROP-SOON",
      validUntil: new Date("2026-08-01T00:00:00.000Z")
    })

    const { getProposalOverviewPageData } = await import("../queries")

    const data = await getProposalOverviewPageData({})

    expect(data.proposals.map((proposal) => proposal.number)).toEqual([
      "PROP-SOON",
      "PROP-LATE",
      "PROP-NONE"
    ])
  })

  test("narrows to the requested statuses and clients from the search params", async () => {
    await makeSettings()

    const targetClient = await makeClient({ name: "Target" })
    const otherClient = await makeClient({ name: "Other" })
    const targetProject = await makeProject({ clientId: targetClient.id })
    const otherProject = await makeProject({ clientId: otherClient.id })

    await makeProposal({ projectId: targetProject.id, number: "PROP-WANTED", status: "sent" })
    await makeProposal({ projectId: targetProject.id, number: "PROP-DRAFT", status: "draft" })
    await makeProposal({ projectId: otherProject.id, number: "PROP-OTHER", status: "sent" })

    const { getProposalOverviewPageData } = await import("../queries")

    const data = await getProposalOverviewPageData({
      status: "sent",
      client: targetClient.id
    })

    expect(data.proposals.map((proposal) => proposal.number)).toEqual(["PROP-WANTED"])
    expect(data.rowCount).toBe(1)
  })

  test("matches the search term against the number, the project, and the client", async () => {
    await makeSettings()

    const client = await makeClient({ name: "Northwind" })
    const project = await makeProject({ clientId: client.id, name: "Rebrand" })

    await makeProposal({ projectId: project.id, number: "PROP-AAA" })

    const { getProposalOverviewPageData } = await import("../queries")

    const byClient = await getProposalOverviewPageData({ search: "northwind" })
    const byProject = await getProposalOverviewPageData({ search: "rebrand" })
    const byNumber = await getProposalOverviewPageData({ search: "AAA" })
    const byNothing = await getProposalOverviewPageData({ search: "zzz" })

    expect(byClient.rowCount).toBe(1)
    expect(byProject.rowCount).toBe(1)
    expect(byNumber.rowCount).toBe(1)
    expect(byNothing.rowCount).toBe(0)
  })
})
