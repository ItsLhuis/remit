import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { clients, invoices, projects, proposals, users } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeUser(overrides?: Partial<InferInsertModel<typeof users>>) {
  const [user] = await database
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: false,
      twoFactorEnabled: false,
      ...overrides
    })
    .returning()

  if (!user) throw new Error("makeUser: insert failed")

  return user
}

export async function makeClient(overrides?: Partial<InferInsertModel<typeof clients>>) {
  const [client] = await database
    .insert(clients)
    .values({
      name: faker.company.name(),
      email: faker.internet.email(),
      ...overrides
    })
    .returning()

  if (!client) throw new Error("makeClient: insert failed")

  return client
}

export async function makeProject(overrides?: Partial<InferInsertModel<typeof projects>>) {
  const clientId = overrides?.clientId ?? (await makeClient()).id

  const [project] = await database
    .insert(projects)
    .values({
      clientId,
      name: faker.commerce.productName(),
      status: "active",
      ...overrides
    })
    .returning()

  if (!project) throw new Error("makeProject: insert failed")

  return project
}

export async function makeProposal(overrides?: Partial<InferInsertModel<typeof proposals>>) {
  const projectId = overrides?.projectId ?? (await makeProject()).id

  const [proposal] = await database
    .insert(proposals)
    .values({
      projectId,
      number: `PROP-${faker.string.alphanumeric(8).toUpperCase()}`,
      status: "draft",
      currency: "EUR",
      publicToken: faker.string.alphanumeric(32),
      subtotalCents: 0,
      discountAmountTotalCents: 0,
      taxAmountCents: 0,
      totalCents: 0,
      viewCount: 0,
      ...overrides
    })
    .returning()

  if (!proposal) throw new Error("makeProposal: insert failed")

  return proposal
}

export async function makeInvoice(overrides?: Partial<InferInsertModel<typeof invoices>>) {
  const needsParent = !overrides?.projectId && !overrides?.clientId
  const clientId = needsParent ? (await makeClient()).id : overrides?.clientId

  const [invoice] = await database
    .insert(invoices)
    .values({
      clientId,
      number: `INV-${faker.string.alphanumeric(8).toUpperCase()}`,
      status: "draft",
      currency: "EUR",
      publicToken: faker.string.alphanumeric(32),
      subtotalCents: 0,
      discountAmountTotalCents: 0,
      taxAmountCents: 0,
      totalCents: 0,
      amountPaidCents: 0,
      viewCount: 0,
      ...overrides
    })
    .returning()

  if (!invoice) throw new Error("makeInvoice: insert failed")

  return invoice
}
