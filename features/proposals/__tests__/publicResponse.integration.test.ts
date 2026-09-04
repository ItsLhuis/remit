import { compareSync } from "bcryptjs"

import { and, eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { mintPublicToken } from "@/lib/publicToken"

import { auditLogs, emailLogs, proposalOtps, proposals } from "@/database/schema"

import {
  makeClient,
  makeClientContact,
  makeLineItem,
  makeProject,
  makeProposal,
  makeProposalOtp,
  makeSettings,
  publicTokenOf
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { requestProposalOtp, verifyProposalOtp } from "../publicResponse"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn(),
  sendTransactionalEmail: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock("@/features/email/server", () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail
}))

const clientEmail = "client@example.com"

const context = { token: "", ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0" }

// The plaintext code only ever exists in the outgoing email, which is exactly the guarantee under
// test: reading it back from the mocked provider is the only way a test can obtain it.
function readSentCode(): string {
  const email = mocks.sendTransactionalEmail.mock.calls.at(-1)?.[0] as { text: string } | undefined
  const code = email?.text.match(/\b\d{6}\b/)?.[0]

  if (!code) throw new Error("No OTP code was sent")

  return code
}

async function makeSentProposal(overrides?: Record<string, unknown>) {
  const client = await makeClient({ email: clientEmail })
  const project = await makeProject({ clientId: client.id })

  const proposal = await makeProposal({
    projectId: project.id,
    status: "sent",
    publicToken: mintPublicToken(),
    issuedAt: new Date("2026-07-01T10:00:00.000Z"),
    totalCents: 100000,
    ...overrides
  })

  await makeLineItem({ proposalId: proposal.id })

  return { client, project, proposal }
}

function requestContext(token: string) {
  return { ...context, token }
}

beforeEach(async () => {
  vi.clearAllMocks()

  mocks.sendTransactionalEmail.mockResolvedValue(undefined)

  await makeSettings({ businessName: "Studio Remit" })
})

describe("requestProposalOtp", () => {
  test("stores a hashed code and emails the plaintext to the client on record", async () => {
    const { proposal } = await makeSentProposal()

    const result = await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )

    const [otp] = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    expect(result).toEqual({ data: { expiresInMinutes: 10 } })
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: clientEmail })
    )
    expect(otp?.codeHash).not.toBe(readSentCode())
    expect(compareSync(readSentCode(), otp?.codeHash ?? "")).toBe(true)
    expect(otp?.attempts).toBe(0)
    expect(otp?.action).toBe("accept")
  })

  test("logs the delivery against the proposal", async () => {
    const { proposal } = await makeSentProposal()

    await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )

    const [log] = await database
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.documentId, proposal.id))

    expect(log?.status).toBe("sent")
    expect(log?.documentType).toBe("proposal")
    expect(log?.recipientEmail).toBe(clientEmail)
  })

  test("supersedes an outstanding code so the attempt ceiling stays per proposal", async () => {
    const { proposal } = await makeSentProposal()

    await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )
    await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )

    const rows = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    expect(rows).toHaveLength(2)
    expect(rows.filter((row) => row.invalidatedAt === null)).toHaveLength(1)
  })

  test("answers identically and sends nothing for an address that is not on record", async () => {
    const { proposal } = await makeSentProposal()

    const result = await requestProposalOtp(
      { action: "accept", email: "stranger@example.com" },
      requestContext(publicTokenOf(proposal))
    )

    const rows = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    expect(result).toEqual({ data: { expiresInMinutes: 10 } })
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled()
    expect(rows).toHaveLength(0)
  })

  test("issues the code to a contact of the client and to that address only", async () => {
    const { client, proposal } = await makeSentProposal()

    await makeClientContact({ clientId: client.id, email: "finance@example.com", isPrimary: true })

    const result = await requestProposalOtp(
      { action: "accept", email: "finance@example.com" },
      requestContext(publicTokenOf(proposal))
    )

    const [otp] = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    expect(result).toEqual({ data: { expiresInMinutes: 10 } })
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "finance@example.com" })
    )
    expect(otp?.email).toBe("finance@example.com")
  })

  test("answers identically and sends nothing for a contact of a different client", async () => {
    const { proposal } = await makeSentProposal()
    const stranger = await makeClient({ email: "other@example.com" })

    await makeClientContact({ clientId: stranger.id, email: "intruder@example.com" })

    const result = await requestProposalOtp(
      { action: "accept", email: "intruder@example.com" },
      requestContext(publicTokenOf(proposal))
    )

    const rows = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    expect(result).toEqual({ data: { expiresInMinutes: 10 } })
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled()
    expect(rows).toHaveLength(0)
  })

  test("answers identically and sends nothing for a soft-deleted contact", async () => {
    const { client, proposal } = await makeSentProposal()

    await makeClientContact({
      clientId: client.id,
      email: "former@example.com",
      deletedAt: new Date("2026-07-02T10:00:00.000Z")
    })

    const result = await requestProposalOtp(
      { action: "accept", email: "former@example.com" },
      requestContext(publicTokenOf(proposal))
    )

    const rows = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    expect(result).toEqual({ data: { expiresInMinutes: 10 } })
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled()
    expect(rows).toHaveLength(0)
  })

  test("refuses a proposal that has already been responded to", async () => {
    const { proposal } = await makeSentProposal({
      status: "accepted",
      respondedAt: new Date(),
      respondedIp: "203.0.113.7"
    })

    const result = await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )

    expect(result).toEqual({ error: expect.any(String) })
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled()
  })

  test("returns the same refusal for an unknown token as for an archived proposal", async () => {
    const { proposal } = await makeSentProposal()

    await database
      .update(proposals)
      .set({ deletedAt: new Date() })
      .where(eq(proposals.id, proposal.id))

    const archived = await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )
    const unknown = await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(mintPublicToken())
    )

    expect(archived).toEqual(unknown)
  })

  test("burns the issued code when the provider refuses the email", async () => {
    const { proposal } = await makeSentProposal()

    mocks.sendTransactionalEmail.mockRejectedValue(new Error("smtp_connection"))

    const result = await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )

    const [otp] = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    const [log] = await database
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.documentId, proposal.id))

    expect(result).toEqual({ error: expect.any(String) })
    expect(otp?.invalidatedAt).not.toBeNull()
    expect(log?.status).toBe("failed")
  })
})

describe("verifyProposalOtp", () => {
  test("accepts the proposal and locks it when the code is correct", async () => {
    const { proposal } = await makeSentProposal()

    await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )

    const result = await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: readSentCode(), rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    const [row] = await database.select().from(proposals).where(eq(proposals.id, proposal.id))

    expect(result).toEqual({ data: { status: "accepted" } })
    expect(row?.status).toBe("accepted")
    expect(row?.lockedAt).not.toBeNull()
    expect(row?.respondedAt).not.toBeNull()
    expect(row?.respondedIp).toBe("203.0.113.7")
    expect(row?.rejectionReason).toBeNull()
  })

  test("accepts the proposal when the contact who received the code answers", async () => {
    const { client, proposal } = await makeSentProposal()

    await makeClientContact({ clientId: client.id, email: "signatory@example.com" })

    await requestProposalOtp(
      { action: "accept", email: "signatory@example.com" },
      requestContext(publicTokenOf(proposal))
    )

    const result = await verifyProposalOtp(
      {
        action: "accept",
        email: "signatory@example.com",
        code: readSentCode(),
        rejectionReason: ""
      },
      requestContext(publicTokenOf(proposal))
    )

    const [row] = await database.select().from(proposals).where(eq(proposals.id, proposal.id))

    expect(result).toEqual({ data: { status: "accepted" } })
    expect(row?.status).toBe("accepted")
  })

  test("refuses a code issued to one identity when another submits it", async () => {
    const { client, proposal } = await makeSentProposal()

    await makeClientContact({ clientId: client.id, email: "signatory@example.com" })

    await requestProposalOtp(
      { action: "accept", email: "signatory@example.com" },
      requestContext(publicTokenOf(proposal))
    )

    const result = await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: readSentCode(), rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    const [row] = await database.select().from(proposals).where(eq(proposals.id, proposal.id))

    expect(result).toEqual({ error: expect.any(String) })
    expect(row?.status).toBe("sent")
  })

  test("marks the code used so it cannot be replayed", async () => {
    const { proposal } = await makeSentProposal()

    await requestProposalOtp(
      { action: "accept", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )

    const code = readSentCode()

    await verifyProposalOtp(
      { action: "accept", email: clientEmail, code, rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    const replay = await verifyProposalOtp(
      { action: "accept", email: clientEmail, code, rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    const [otp] = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    expect(otp?.usedAt).not.toBeNull()
    expect(replay).toEqual({ error: expect.any(String) })
  })

  test("records the reason and leaves the proposal unlocked when declined", async () => {
    const { proposal } = await makeSentProposal()

    await requestProposalOtp(
      { action: "reject", email: clientEmail },
      requestContext(publicTokenOf(proposal))
    )

    const result = await verifyProposalOtp(
      {
        action: "reject",
        email: clientEmail,
        code: readSentCode(),
        rejectionReason: "Budget moved to next quarter"
      },
      requestContext(publicTokenOf(proposal))
    )

    const [row] = await database.select().from(proposals).where(eq(proposals.id, proposal.id))

    expect(result).toEqual({ data: { status: "rejected" } })
    expect(row?.status).toBe("rejected")
    expect(row?.rejectionReason).toBe("Budget moved to next quarter")
    expect(row?.lockedAt).toBeNull()
    expect(row?.respondedIp).toBe("203.0.113.7")
  })

  test("refuses a decline with no reason", async () => {
    const { proposal } = await makeSentProposal()

    const result = await verifyProposalOtp(
      { action: "reject", email: clientEmail, code: "123456", rejectionReason: "   " },
      requestContext(publicTokenOf(proposal))
    )

    const [row] = await database.select().from(proposals).where(eq(proposals.id, proposal.id))

    expect(result).toEqual({ error: expect.any(String) })
    expect(row?.status).toBe("sent")
  })

  test("counts a wrong code against the attempt ceiling and leaves the proposal sent", async () => {
    const { proposal } = await makeSentProposal()

    await makeProposalOtp({ proposalId: proposal.id, email: clientEmail, code: "123456" })

    const result = await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: "999999", rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    const [otp] = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    const [row] = await database.select().from(proposals).where(eq(proposals.id, proposal.id))

    expect(result).toEqual({ error: expect.any(String) })
    expect(otp?.attempts).toBe(1)
    expect(otp?.invalidatedAt).toBeNull()
    expect(row?.status).toBe("sent")
  })

  test("burns the code on the fifth wrong guess", async () => {
    const { proposal } = await makeSentProposal()

    await makeProposalOtp({
      proposalId: proposal.id,
      email: clientEmail,
      code: "123456",
      attempts: 4
    })

    await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: "999999", rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    const correct = await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: "123456", rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    const [otp] = await database
      .select()
      .from(proposalOtps)
      .where(eq(proposalOtps.proposalId, proposal.id))

    expect(otp?.attempts).toBe(5)
    expect(otp?.invalidatedAt).not.toBeNull()
    expect(correct).toEqual({ error: expect.any(String) })
  })

  test("refuses an expired code", async () => {
    const { proposal } = await makeSentProposal()

    await makeProposalOtp({
      proposalId: proposal.id,
      email: clientEmail,
      code: "123456",
      expiresAt: new Date(Date.now() - 1000)
    })

    const result = await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: "123456", rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    const [row] = await database.select().from(proposals).where(eq(proposals.id, proposal.id))

    expect(result).toEqual({ error: expect.any(String) })
    expect(row?.status).toBe("sent")
  })

  test("refuses a code issued for the other action", async () => {
    const { proposal } = await makeSentProposal()

    await makeProposalOtp({
      proposalId: proposal.id,
      email: clientEmail,
      code: "123456",
      action: "reject"
    })

    const result = await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: "123456", rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    expect(result).toEqual({ error: expect.any(String) })
  })

  test("refuses a code presented with a different address", async () => {
    const { proposal } = await makeSentProposal()

    await makeProposalOtp({ proposalId: proposal.id, email: clientEmail, code: "123456" })

    const result = await verifyProposalOtp(
      { action: "accept", email: "stranger@example.com", code: "123456", rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    expect(result).toEqual({ error: expect.any(String) })
  })

  test("audits the acceptance without an actor and without the token", async () => {
    const { proposal } = await makeSentProposal()

    await makeProposalOtp({ proposalId: proposal.id, email: clientEmail, code: "123456" })

    await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: "123456", rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    const [entry] = await database
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.event, "proposal.accepted"), eq(auditLogs.targetEntityId, proposal.id))
      )

    expect(entry?.actorUserId).toBeNull()
    expect(entry?.ipAddress).toBe("203.0.113.7")
    expect(entry?.userAgent).toBe("Mozilla/5.0")
    expect(JSON.stringify(entry?.metadata)).not.toContain(publicTokenOf(proposal))
  })

  test("emits the acceptance and revalidates the internal proposal surfaces", async () => {
    const { project, proposal } = await makeSentProposal()

    await makeProposalOtp({ proposalId: proposal.id, email: clientEmail, code: "123456" })

    await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: "123456", rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )

    expect(mocks.emit).toHaveBeenCalledWith("proposal.accepted", {
      proposalId: proposal.id,
      projectId: project.id
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/proposals")
  })

  test("returns the same refusal for an unknown token as for an archived proposal", async () => {
    const { proposal } = await makeSentProposal()

    await makeProposalOtp({ proposalId: proposal.id, email: clientEmail, code: "123456" })
    await database
      .update(proposals)
      .set({ deletedAt: new Date() })
      .where(eq(proposals.id, proposal.id))

    const archived = await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: "123456", rejectionReason: "" },
      requestContext(publicTokenOf(proposal))
    )
    const unknown = await verifyProposalOtp(
      { action: "accept", email: clientEmail, code: "123456", rejectionReason: "" },
      requestContext(mintPublicToken())
    )

    expect(archived).toEqual(unknown)
  })
})
