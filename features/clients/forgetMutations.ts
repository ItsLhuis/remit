"use server"

import { revalidatePath } from "next/cache"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { clients } from "@/database/schema"

import { forgetClientWrite } from "./forget"
import {
  ExpectedClientError,
  handleClientActionError,
  requireClientDelete,
  writeClientAudit
} from "./mutationContext"
import { forgetClientSchema } from "./schemas"

const clientsPath = "/clients"

type ForgetClientResultShape = { data: { id: string } } | { error: string }

export async function forgetClient(input: unknown): Promise<ForgetClientResultShape> {
  const gate = await requireClientDelete()

  if ("error" in gate) return gate

  const parsed = forgetClientSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.clients.findFirst({
      columns: { id: true, name: true },
      where: eq(clients.id, parsed.data.id)
    })

    if (!existing) throw new ExpectedClientError(t("clients.errors.notFound"))

    // Compared before anything is read or deleted, and compared exactly: a confirmation that
    // tolerated a near miss would not be a confirmation.
    if (parsed.data.confirmation.trim() !== existing.name.trim()) {
      throw new ExpectedClientError(t("clients.forget.errors.confirmationMismatch"))
    }

    const result = await forgetClientWrite(existing.id)

    if (result.status === "not_found") throw new ExpectedClientError(t("clients.errors.notFound"))

    if (result.status === "blocked_by_signature") {
      throw new ExpectedClientError(
        t("clients.forget.errors.signedContract", { count: result.signedContracts })
      )
    }

    // The audit entry names the client id and the per-table counts, never the client's name, email
    // or any other personal detail: the trail records that an erasure happened and who performed it,
    // which is the one thing that must survive it.
    await writeClientAudit(context, "client.forgotten", existing.id, {
      deletedCounts: result.counts
    })

    revalidatePath(clientsPath)
    revalidatePath(`${clientsPath}/${existing.id}`)

    return { data: { id: existing.id } }
  } catch (error) {
    return handleClientActionError(error, "forgetClient", context.userId, parsed.data.id)
  }
}
