import { and, eq, exists, inArray, or, sql, type SQL } from "drizzle-orm"

import { readUploadReferences, releaseObjects } from "@/lib/storage/objectDeletions"

import { database } from "@/database"
import {
  activityLogs,
  clientContacts,
  clients,
  contracts,
  contractSignatures,
  creditNotes,
  dataExports,
  emailLogs,
  expenses,
  invoices,
  payments,
  projects,
  proposals,
  recurringInvoices,
  tasks,
  timeEntries
} from "@/database/schema"

export type ForgetClientCounts = Record<string, number>

export type ForgetClientResult =
  | {
      status: "forgotten"
      name: string
      counts: ForgetClientCounts
      storageObjects: number
      deletionIds: string[]
    }
  | { status: "blocked_by_signature"; signedContracts: number }
  | { status: "not_found" }

type ForgetTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0]

type DeletableTable = Parameters<ForgetTransaction["delete"]>[0]

// The right to be forgotten (ARCHITECTURE.md, "Data export and deletion"). Unlike the retention
// purge this ignores every window: the owner is answering an erasure request rather than tidying a
// trash, and no window can hold data the subject has asked to have removed.
//
// The files go too, without ever being gone while a row still names them (ADR-0049). Every object the
// erased rows were the last to reference — the client's image, attachments, document PDFs, receipts
// and data export archives — is released into `object_deletions` in this transaction and removed from
// the bucket only after it commits (`forgetMutations.ts`). The transaction runs at repeatable read
// because "the last to reference" is the difference between two reads of every reference, and only
// one snapshot keeps a concurrent session's writes out of it.
//
// The order below is the domain inventory's FK-safe order narrowed to one client's subgraph, and two
// of its positions are load-bearing rather than incidental. The runtime logs go first because their
// rows carry ids rather than foreign keys, so nothing would clean them up afterwards. Projects go
// before the client, so `fk_contracts_project_client`'s `ON DELETE SET NULL (project_id)` has
// already run by the time the client delete nulls `client_id`, and
// `chk_contracts_project_requires_client` never sees a surviving contract naming a project with no
// client.
export async function forgetClientWrite(clientId: string): Promise<ForgetClientResult> {
  return database.transaction(
    async (transaction) => {
      const client = await transaction.query.clients.findFirst({
        columns: { id: true, name: true },
        where: eq(clients.id, clientId)
      })

      if (!client) return { status: "not_found" }

      const projectIds = await selectIds(
        transaction
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.clientId, clientId))
      )

      const invoiceIds = await selectIds(
        transaction
          .select({ id: invoices.id })
          .from(invoices)
          .where(belongsToClient(invoices.clientId, invoices.projectId, clientId, projectIds))
      )

      const proposalIds = await selectIds(
        transaction
          .select({ id: proposals.id })
          .from(proposals)
          .where(belongsToClient(proposals.clientId, proposals.projectId, clientId, projectIds))
      )

      // A countersigned contract makes the whole erasure impossible, and the schema is what says so.
      // Its signature is insert-only, so the contract cannot be deleted (the delete cascades into the
      // signature and the trigger raises); but leaving it standing is not available either, because
      // removing the client nulls `contracts.client_id` and removing the project nulls
      // `project_id`, and `chk_contracts_parent` requires one of the two. Remit therefore refuses
      // rather than half-erasing, and says which contracts are in the way.
      const clientContracts = belongsToClient(
        contracts.clientId,
        contracts.projectId,
        clientId,
        projectIds
      )

      // One read, partitioned here rather than two reads with opposite predicates: the queries in this
      // function share the transaction's single connection, so a second round trip buys nothing and
      // cannot overlap with the first.
      const clientContractRows = await transaction
        .select({ id: contracts.id, signed: isCountersigned() })
        .from(contracts)
        .where(clientContracts)

      const signedContracts = clientContractRows.filter((row) => row.signed).length

      if (signedContracts > 0) return { status: "blocked_by_signature", signedContracts }

      const contractIds = clientContractRows.map((row) => row.id)

      const referencedBefore = await readUploadReferences(transaction)

      const counts: ForgetClientCounts = {}

      counts.activity_logs = await deleteRows(
        transaction,
        activityLogs,
        or(
          and(eq(activityLogs.entityType, "client"), eq(activityLogs.entityId, clientId)),
          activityIn("project", projectIds),
          activityIn("invoice", invoiceIds),
          activityIn("proposal", proposalIds),
          activityIn("contract", contractIds)
        )
      )

      counts.email_logs = await deleteRows(
        transaction,
        emailLogs,
        or(
          documentIn("invoice", invoiceIds),
          documentIn("proposal", proposalIds),
          documentIn("contract", contractIds)
        )
      )

      const exportArchives = await transaction
        .delete(dataExports)
        .where(eq(dataExports.clientId, clientId))
        .returning({ storageKey: dataExports.storageKey })

      counts.data_exports = exportArchives.length

      counts.payments = await deleteRows(
        transaction,
        payments,
        idsIn(payments.invoiceId, invoiceIds)
      )

      counts.credit_notes = await deleteRows(
        transaction,
        creditNotes,
        idsIn(creditNotes.invoiceId, invoiceIds)
      )

      counts.contracts = await deleteRows(transaction, contracts, idsIn(contracts.id, contractIds))

      counts.invoices = await deleteRows(transaction, invoices, idsIn(invoices.id, invoiceIds))

      counts.proposals = await deleteRows(transaction, proposals, idsIn(proposals.id, proposalIds))

      counts.recurring_invoices = await deleteRows(
        transaction,
        recurringInvoices,
        belongsToClient(
          recurringInvoices.clientId,
          recurringInvoices.projectId,
          clientId,
          projectIds
        )
      )

      counts.expenses = await deleteRows(
        transaction,
        expenses,
        belongsToClient(expenses.clientId, expenses.projectId, clientId, projectIds)
      )

      counts.time_entries = await deleteRows(
        transaction,
        timeEntries,
        idsIn(timeEntries.projectId, projectIds)
      )

      counts.tasks = await deleteRows(transaction, tasks, idsIn(tasks.projectId, projectIds))

      counts.projects = await deleteRows(transaction, projects, idsIn(projects.id, projectIds))

      counts.client_contacts = await deleteRows(
        transaction,
        clientContacts,
        eq(clientContacts.clientId, clientId)
      )

      counts.clients = await deleteRows(transaction, clients, eq(clients.id, clientId))

      const release = await releaseObjects(transaction, {
        referencedBefore,
        objects: exportArchives.flatMap(({ storageKey }) =>
          storageKey ? [{ bucket: "exports" as const, key: storageKey }] : []
        )
      })

      return {
        status: "forgotten",
        name: client.name,
        counts,
        storageObjects: release.objects,
        deletionIds: release.deletionIds
      }
    },
    { isolationLevel: "repeatable read" }
  )
}

// The countersigned contracts that would make `forgetClientWrite` refuse, read ahead of it so the
// erasure dialog can say so before the owner types the client's name. The same predicate as the
// write, so the warning and the refusal cannot disagree about which contracts are in the way.
export async function listErasureBlockingContracts(clientId: string): Promise<string[]> {
  const projectIds = await selectIds(
    database.select({ id: projects.id }).from(projects).where(eq(projects.clientId, clientId))
  )

  const rows = await database
    .select({ number: contracts.number })
    .from(contracts)
    .where(
      and(
        belongsToClient(contracts.clientId, contracts.projectId, clientId, projectIds),
        isCountersigned()
      )
    )
    .orderBy(contracts.number)

  return rows.map((row) => row.number)
}

function isCountersigned(): SQL {
  return exists(
    database
      .select({ one: contractSignatures.id })
      .from(contractSignatures)
      .where(eq(contractSignatures.contractId, contracts.id))
  )
}

async function selectIds(query: Promise<{ id: string }[]>): Promise<string[]> {
  return (await query).map((row) => row.id)
}

function activityIn(
  entity: "project" | "invoice" | "proposal" | "contract",
  ids: string[]
): SQL | undefined {
  if (ids.length === 0) return undefined

  return and(eq(activityLogs.entityType, entity), inArray(activityLogs.entityId, ids))
}

function documentIn(document: "invoice" | "proposal" | "contract", ids: string[]): SQL | undefined {
  if (ids.length === 0) return undefined

  return and(eq(emailLogs.documentType, document), inArray(emailLogs.documentId, ids))
}

function idsIn(column: Parameters<typeof inArray>[0], ids: string[]): SQL | undefined {
  if (ids.length === 0) return undefined

  return inArray(column, ids)
}

// Both halves of the client link, because a document may name the client, its project, or both —
// and `fk_<table>_project_client` is what guarantees the two agree whenever both are present.
function belongsToClient(
  clientColumn: Parameters<typeof eq>[0],
  projectColumn: Parameters<typeof inArray>[0],
  clientId: string,
  projectIds: string[]
): SQL | undefined {
  return or(eq(clientColumn, clientId), idsIn(projectColumn, projectIds))
}

async function deleteRows(
  transaction: ForgetTransaction,
  table: DeletableTable,
  where: SQL | undefined
): Promise<number> {
  if (!where) return 0

  const deleted = await transaction
    .delete(table)
    .where(where)
    .returning({ marker: sql<number>`1` })

  return deleted.length
}
