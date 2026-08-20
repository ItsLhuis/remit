import { revalidatePath } from "next/cache"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { enqueueJob } from "@/lib/jobs"

import { database } from "@/database"
import { contractSignatures, contracts } from "@/database/schema"

import { emitContractSigned } from "./events"
import { getContractSigningTarget } from "./publicQueries"
import { signContractSchema, type ContractStatus } from "./schemas"
import { canTransitionContractStatus } from "./services"
import { type ContractSigningTarget } from "./types"

// The anonymous write path behind `/c/[token]`, deliberately NOT a `"use server"` module. Server
// actions are callable by id from any client, which would let a caller reach this write without
// passing through the rate limit declared in `sign/route.ts`. A plain server-only function can only
// be reached through that route. Exported via `server.ts`.
//
// This is signature capture, not the proposals' OTP: no code is issued, nothing is emailed, and
// identity is the signer's own typed attestation plus the request metadata recorded alongside it.

export type PublicContractSignContext = {
  token: string
  ipAddress: string | null
  userAgent: string | null
}

export type SignPublicContractResult =
  | { data: { status: ContractStatus; signedAt: Date } }
  | { error: string }

type RecordContractSignatureInput = {
  target: ContractSigningTarget
  signerName: string
  signerEmail: string
  ipAddress: string
  userAgent: string
  signedAt: Date
}

// `contract_signatures.ip_address` and `.user_agent` are NOT NULL, and both `getIpAddress` and the
// user-agent header yield null on a request that carries neither. The absence is recorded
// explicitly rather than failing a signature over a deployment or client detail.
const UNKNOWN_REQUEST_METADATA = "unknown"

export async function signPublicContract(
  input: unknown,
  context: PublicContractSignContext
): Promise<SignPublicContractResult> {
  const parsed = signContractSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const target = await getContractSigningTarget({ token: context.token })

  if (!target) return { error: t("contracts.public.errors.unavailable") }

  const transition = canTransitionContractStatus(target.status, "signed")

  if (!transition.allowed) return { error: t("contracts.public.errors.alreadySigned") }

  const signedAt = new Date()

  let signatureId: string

  try {
    signatureId = await recordContractSignature({
      target,
      signerName: parsed.data.signerName,
      signerEmail: parsed.data.signerEmail,
      ipAddress: context.ipAddress ?? UNKNOWN_REQUEST_METADATA,
      userAgent: context.userAgent ?? UNKNOWN_REQUEST_METADATA,
      signedAt
    })
  } catch (error) {
    if (error instanceof ExpectedSigningError) return { error: error.message }

    logger.error(
      { action: "signPublicContract", contractId: target.id, err: error },
      "Contract signature write failed"
    )

    return { error: t("contracts.public.errors.signFailed") }
  }

  // `actorUserId` is null because nobody is signed in, and `context.token` is never recorded: the
  // audit table is readable by anyone with database access and the token is a bearer credential for
  // this route (`security.md`).
  await writeAudit("contract.signed", {
    actorUserId: null,
    targetEntityType: "contract",
    targetEntityId: target.id,
    metadata: {
      projectId: target.projectId,
      clientId: target.clientId,
      signatureId,
      signerEmail: parsed.data.signerEmail,
      signedAt: signedAt.toISOString()
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
  await emitContractSigned({ contractId: target.id, signatureId })
  // The executed document is rendered out of band per ADR-0022, which is why the signature id
  // travels with the job: the worker needs it to attach the stored PDF to this exact signature.
  //
  // `contract_signatures` is otherwise insert-only: the `contract_signatures_set_signed_pdf` guard
  // from `0001_insert_only_guards.sql` lets the worker fill `signed_pdf_upload_id` exactly once and
  // raises on every other UPDATE, so nothing on this path may write that column itself.
  await enqueueJob("contract.signed_pdf.render", { contractId: target.id, signatureId })

  revalidateContractSigningPaths(target)

  return { data: { status: transition.nextStatus, signedAt } }
}

// One transaction so a contract can be signed exactly once. The status write is guarded on the
// contract still being `sent`, so two requests racing leave one winner and roll the loser back
// whole — including its signature row, which is what keeps the insert-only trail free of orphans.
async function recordContractSignature({
  target,
  signerName,
  signerEmail,
  ipAddress,
  userAgent,
  signedAt
}: RecordContractSignatureInput): Promise<string> {
  return database.transaction(async (transaction) => {
    const [signed] = await transaction
      .update(contracts)
      .set({ status: "signed" })
      .where(
        and(eq(contracts.id, target.id), eq(contracts.status, "sent"), isNull(contracts.deletedAt))
      )
      .returning({ id: contracts.id })

    if (!signed) throw new ExpectedSigningError(t("contracts.public.errors.alreadySigned"))

    // `consent_text` is the server's own wording, resolved with the contract into the signing
    // target — never a value the client sent — so the snapshot is provably what the page displayed.
    const [signature] = await transaction
      .insert(contractSignatures)
      .values({
        contractId: target.id,
        signerName,
        signerEmail,
        consentText: target.consentText,
        ipAddress,
        userAgent,
        signedAt
      })
      .returning({ id: contractSignatures.id })

    if (!signature) throw new Error("Contract signature insert returned no row")

    return signature.id
  })
}

function revalidateContractSigningPaths(target: ContractSigningTarget): void {
  revalidatePath("/contracts")
  revalidatePath(`/contracts/${target.id}`)

  if (target.projectId) revalidatePath(`/projects/${target.projectId}`)
  if (target.clientId) revalidatePath(`/clients/${target.clientId}`)
}

class ExpectedSigningError extends Error {}
