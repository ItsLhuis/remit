import { hashSync } from "bcryptjs"

import { type InferInsertModel } from "drizzle-orm"

import { proposalOtps } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeProposal } from "./proposals"

const OTP_TTL_MS = 10 * 60 * 1000

// Cost 4 rather than the application's 10: a suite that hashes a dozen fixtures at cost 10 spends
// most of its wall clock inside bcrypt. The stored format is identical, so `compare` in
// `publicResponse.ts` reads it exactly as it reads a production hash.
const TEST_BCRYPT_COST = 4

type ProposalOtpOverrides = Partial<InferInsertModel<typeof proposalOtps>> & {
  code?: string
}

export async function makeProposalOtp({
  code = "123456",
  ...overrides
}: ProposalOtpOverrides = {}) {
  const proposalId = overrides.proposalId ?? (await makeProposal()).id

  const [otp] = await database
    .insert(proposalOtps)
    .values({
      proposalId,
      action: "accept",
      codeHash: hashSync(code, TEST_BCRYPT_COST),
      email: "client@example.com",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      ...overrides
    })
    .returning()

  if (!otp) throw new Error("makeProposalOtp: insert failed")

  return otp
}
