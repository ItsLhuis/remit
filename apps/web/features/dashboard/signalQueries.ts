import { and, count, eq, isNull, lte, notInArray, sql } from "drizzle-orm"

import { database } from "@/database"
import {
  clients,
  contracts,
  leads,
  projects,
  proposals,
  recurringInvoices,
  tasks
} from "@/database/schema"

import {
  type AttentionContractRow,
  type AttentionProposalRow,
  type AttentionTaskRow,
  type LeadStatusCount,
  type UpcomingScheduleRow
} from "./services"

const TASK_HORIZON_DAYS = 14
const MILLISECONDS_PER_DAY = 86_400_000

// The four documents behind the attention rail and the lead pipeline, split out of queries.ts along
// the seam that already exists in the data: none of them carries money the dashboard sums, so none
// of them is read for a tile. `getDashboardPageData` issues them alongside the money reads in one
// `Promise.all`, so the split is organisational and costs no extra round trip.
export async function listLeadStatusCounts(): Promise<LeadStatusCount[]> {
  const rows = await database
    .select({ status: leads.status, count: count() })
    .from(leads)
    .where(isNull(leads.deletedAt))
    .groupBy(leads.status)

  return rows.map((row) => ({ status: row.status, count: Number(row.count) }))
}

export async function listOpenProposals(): Promise<AttentionProposalRow[]> {
  const rows = await database
    .select({
      id: proposals.id,
      number: proposals.number,
      currency: proposals.currency,
      totalCents: proposals.totalCents,
      validUntil: proposals.validUntil,
      issuedAt: proposals.issuedAt,
      viewCount: proposals.viewCount,
      parentName: sql<string | null>`coalesce(${clients.name}, ${projects.name})`
    })
    .from(proposals)
    .leftJoin(projects, eq(projects.id, proposals.projectId))
    .leftJoin(clients, eq(clients.id, proposals.clientId))
    .where(and(eq(proposals.status, "sent"), isNull(proposals.deletedAt)))

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    parentName: row.parentName ?? "",
    currency: row.currency,
    totalCents: Number(row.totalCents),
    validUntil: row.validUntil,
    issuedAt: row.issuedAt,
    viewCount: row.viewCount
  }))
}

export async function listOpenContracts(): Promise<AttentionContractRow[]> {
  return database
    .select({
      id: contracts.id,
      number: contracts.number,
      title: contracts.title,
      issuedAt: contracts.issuedAt
    })
    .from(contracts)
    .where(and(eq(contracts.status, "sent"), isNull(contracts.deletedAt)))
}

// Bounded in SQL by a horizon wider than the rail's own three-day window, so the service still
// decides what counts as due while the read stays indexed by `tasks_due_at_idx`.
export async function listDueTasks(now: Date): Promise<AttentionTaskRow[]> {
  const horizon = new Date(now.getTime() + TASK_HORIZON_DAYS * MILLISECONDS_PER_DAY)

  const rows = await database
    .select({
      id: tasks.id,
      title: tasks.title,
      projectId: tasks.projectId,
      dueAt: tasks.dueAt,
      projectName: projects.name
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        isNull(tasks.deletedAt),
        isNull(projects.deletedAt),
        notInArray(tasks.status, ["done", "cancelled"]),
        lte(tasks.dueAt, horizon)
      )
    )

  return rows.flatMap((row) =>
    row.dueAt ? [{ ...row, dueAt: row.dueAt, projectName: row.projectName }] : []
  )
}

export async function listActiveSchedules(): Promise<UpcomingScheduleRow[]> {
  const rows = await database
    .select({
      id: recurringInvoices.id,
      name: recurringInvoices.name,
      cadence: recurringInvoices.cadence,
      nextRunAt: recurringInvoices.nextRunAt,
      clientName: clients.name
    })
    .from(recurringInvoices)
    .innerJoin(clients, eq(clients.id, recurringInvoices.clientId))
    .where(and(eq(recurringInvoices.status, "active"), isNull(recurringInvoices.deletedAt)))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    clientName: row.clientName,
    cadence: String(row.cadence),
    nextRunAt: row.nextRunAt
  }))
}
