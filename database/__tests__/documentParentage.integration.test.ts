import { eq, getTableName, sql } from "drizzle-orm"
import { type PgTable } from "drizzle-orm/pg-core"

import { beforeEach, describe, expect, test } from "vitest"

import {
  contracts,
  expenses,
  invoices,
  projects,
  proposals,
  recurringInvoices
} from "@/database/schema"

import { makeClient, makeProject } from "@/tests/factories"
import { database } from "@/tests/integration/database"

// The seven rows of the parentage contract, run against real Postgres for each of the five tables
// that carry both a `project_id` and a `client_id`. A mocked database proves nothing about a foreign
// key, so every case here inserts or mutates real rows and reads the error Postgres actually raises.
//
// Each table needs a different set of NOT NULL columns filled in, so the fixtures below build the
// minimum legal row per table rather than going through the factories, which would supply the
// agreeing parent pair that half these cases exist to violate.
type ParentRow = { projectId: string | null; clientId: string | null }

type ParentedTable = {
  name: string
  table: PgTable
  values: (parents: ParentRow, suffix: string) => Record<string, unknown>
}

const PARENTED_TABLES: ParentedTable[] = [
  {
    name: "invoices",
    table: invoices,
    values: (parents, suffix) => ({ ...parents, number: `INV-${suffix}`, publicToken: suffix })
  },
  {
    name: "proposals",
    table: proposals,
    values: (parents, suffix) => ({ ...parents, number: `PROP-${suffix}`, publicToken: suffix })
  },
  {
    name: "expenses",
    table: expenses,
    values: (parents) => ({
      ...parents,
      amountCents: 1000,
      currency: "EUR",
      category: "Software",
      description: "Seat licence",
      spentAt: new Date("2026-08-01T00:00:00.000Z")
    })
  },
  {
    name: "contracts",
    table: contracts,
    values: (parents, suffix) => ({
      ...parents,
      number: `CTR-${suffix}`,
      title: "Retainer",
      publicToken: suffix
    })
  },
  {
    name: "recurring_invoices",
    table: recurringInvoices,
    values: (parents) => ({
      ...parents,
      name: "Monthly retainer",
      cadence: "monthly" as const,
      nextRunAt: new Date(Date.UTC(2026, 8, 1))
    })
  }
]

// `recurring_invoices.client_id` is NOT NULL, so the "project with no client" case cannot even be
// expressed there: the column refuses it before `chk_recurring_invoices_project_requires_client`
// is consulted, and Postgres names the column rather than a constraint. Either way the row is
// rejected, which is what the case asserts.
const NULL_CLIENT_REJECTION: Record<string, string> = {
  invoices: "chk_invoices_project_requires_client",
  proposals: "chk_proposals_project_requires_client",
  expenses: "chk_expenses_project_requires_client",
  contracts: "chk_contracts_project_requires_client",
  recurring_invoices: "client_id"
}

// Drizzle wraps the driver error, and its own message is only the failed SQL, so the constraint that
// actually refused the write is on the cause. Asserting the name rather than the message is what
// makes these tests fail loudly if a rule is enforced by something other than the constraint named.
async function rejectionOf(query: Promise<unknown>): Promise<string> {
  try {
    await query
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause ?? error
    const detail = cause as { constraint_name?: string; column_name?: string }

    return detail.constraint_name ?? detail.column_name ?? ""
  }

  throw new Error("Expected the query to be rejected, but it succeeded")
}

function insertParented(entry: ParentedTable, parents: ParentRow, suffix: string) {
  return database.insert(entry.table).values(entry.values(parents, suffix))
}

async function countRows(table: PgTable): Promise<number> {
  const [row] = await database.select({ value: sql<number>`count(*)::int` }).from(table)

  return row?.value ?? 0
}

describe.each(PARENTED_TABLES)("$name parentage", (entry) => {
  let clientId = ""
  let otherClientId = ""
  let projectId = ""
  let suffix = ""

  beforeEach(async () => {
    const client = await makeClient()
    const otherClient = await makeClient()
    const project = await makeProject({ clientId: client.id })

    clientId = client.id
    otherClientId = otherClient.id
    projectId = project.id
    suffix = `${getTableName(entry.table)}-parentage`.slice(0, 40)
  })

  test("accepts a row naming a project and that project's own client", async () => {
    await insertParented(entry, { projectId, clientId }, suffix)

    expect(await countRows(entry.table)).toBe(1)
  })

  test("rejects a row naming a project and a different client", async () => {
    const constraint = await rejectionOf(
      insertParented(entry, { projectId, clientId: otherClientId }, suffix)
    )

    expect(constraint).toBe(`fk_${getTableName(entry.table)}_project_client`)
    expect(await countRows(entry.table)).toBe(0)
  })

  test("accepts a client-level row with no project", async () => {
    await insertParented(entry, { projectId: null, clientId }, suffix)

    expect(await countRows(entry.table)).toBe(1)
  })

  test("rejects a row naming a project with no client", async () => {
    const constraint = await rejectionOf(
      insertParented(entry, { projectId, clientId: null }, suffix)
    )

    expect(constraint).toBe(NULL_CLIENT_REJECTION[getTableName(entry.table)])
    expect(await countRows(entry.table)).toBe(0)
  })

  test("refuses to move the project to another client while the row exists", async () => {
    await insertParented(entry, { projectId, clientId }, suffix)

    const constraint = await rejectionOf(
      database.update(projects).set({ clientId: otherClientId }).where(eq(projects.id, projectId))
    )

    expect(constraint).toBe(`fk_${getTableName(entry.table)}_project_client`)

    const [project] = await database.select().from(projects).where(eq(projects.id, projectId))

    expect(project?.clientId).toBe(clientId)
  })

  test("allows every other change to the project", async () => {
    await insertParented(entry, { projectId, clientId }, suffix)

    await database.update(projects).set({ name: "Renamed" }).where(eq(projects.id, projectId))

    const [project] = await database.select().from(projects).where(eq(projects.id, projectId))

    expect(project?.name).toBe("Renamed")
  })

  test("nulls the project and keeps the client when the project is hard deleted", async () => {
    await insertParented(entry, { projectId, clientId }, suffix)

    await database.delete(projects).where(eq(projects.id, projectId))

    const [row] = await database.select().from(entry.table)

    expect(row).toMatchObject({ projectId: null, clientId })
  })
})
