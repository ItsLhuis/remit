"use server"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { mintPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import { invoices } from "@/database/schema"

import {
  handleInvoiceActionError,
  requireInvoicePublicLink,
  revalidateInvoicePaths,
  writeInvoiceAudit,
  ExpectedInvoiceError
} from "./mutationContext"
import { invoiceIdSchema } from "./schemas"
import { type InvoicePublicLinkResult } from "./types"

// The lifecycle of `/i/[token]`, kept out of mutations.ts because it answers to a different
// question: those actions change what the invoice *says*, these change who can still read it
// (ADR-0029). Rotation and revocation are one pair of operations shared by all four token holders;
// the client portal's pair lives in `features/clients/mutations.ts`, whose file length left no
// reason to split it out.

export async function rotateInvoicePublicLink(input: unknown): Promise<InvoicePublicLinkResult> {
  const gate = await requireInvoicePublicLink()

  if ("error" in gate) return gate

  const parsed = invoiceIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await loadIssuedInvoiceForPublicLink(parsed.data.id)

    const [rotated] = await database
      .update(invoices)
      .set({ publicToken: mintPublicToken() })
      .where(and(eq(invoices.id, existing.id), isNull(invoices.deletedAt)))
      .returning({
        id: invoices.id,
        projectId: invoices.projectId,
        clientId: invoices.clientId
      })

    if (!rotated) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

    // Records that the link changed and what it changed from, never either token: the audit trail is
    // readable by anyone with database access, and the old and new values are both bearer
    // credentials for `/i/[token]` (`security.md`).
    await writeInvoiceAudit(context, "invoice.public_link.rotated", rotated.id, {
      projectId: rotated.projectId,
      clientId: rotated.clientId,
      previousState: existing.publicToken ? "live" : "none"
    })

    revalidateInvoicePaths(rotated)

    return { data: { id: rotated.id } }
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "rotateInvoicePublicLink",
      userId: context.userId,
      invoiceId: parsed.data.id,
      fallbackMessage: t("invoices.errors.publicLinkFailed")
    })
  }
}

export async function revokeInvoicePublicLink(input: unknown): Promise<InvoicePublicLinkResult> {
  const gate = await requireInvoicePublicLink()

  if ("error" in gate) return gate

  const parsed = invoiceIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await loadIssuedInvoiceForPublicLink(parsed.data.id)

    if (!existing.publicToken) {
      throw new ExpectedInvoiceError(t("invoices.errors.publicLinkAlreadyRevoked"))
    }

    const [revoked] = await database
      .update(invoices)
      .set({ publicToken: null })
      .where(and(eq(invoices.id, existing.id), isNull(invoices.deletedAt)))
      .returning({
        id: invoices.id,
        projectId: invoices.projectId,
        clientId: invoices.clientId
      })

    if (!revoked) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

    await writeInvoiceAudit(context, "invoice.public_link.revoked", revoked.id, {
      projectId: revoked.projectId,
      clientId: revoked.clientId
    })

    revalidateInvoicePaths(revoked)

    return { data: { id: revoked.id } }
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "revokeInvoicePublicLink",
      userId: context.userId,
      invoiceId: parsed.data.id,
      fallbackMessage: t("invoices.errors.publicLinkFailed")
    })
  }
}

// Both link actions refuse a draft. Its token exists but has never left the instance, so there is no
// URL to withdraw and rotating one would invalidate nothing; refusing here is also what lets
// `sendInvoice` above rely on a draft still carrying a token.
async function loadIssuedInvoiceForPublicLink(invoiceId: string) {
  const invoice = await database.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)),
    columns: { id: true, status: true, publicToken: true }
  })

  if (!invoice) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

  if (invoice.status === "draft") {
    throw new ExpectedInvoiceError(t("invoices.errors.publicLinkNotIssued"))
  }

  return invoice
}
