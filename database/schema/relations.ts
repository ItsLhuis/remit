import { relations } from "drizzle-orm"

import { activityLogs } from "./activityLogs"
import { auditLogs } from "./auditLogs"
import { users } from "./auth"
import { clients } from "./clients"
import { contracts } from "./contracts"
import { dataExports } from "./dataExports"
import { emailLogs } from "./emailLogs"
import { invoices } from "./invoices"
import { lineItems } from "./lineItems"
import { projects } from "./projects"
import { proposalOtps } from "./proposalOtps"
import { proposals } from "./proposals"
import { recurringInvoices } from "./recurringInvoices"
import { taxRates } from "./taxRates"
import { templates } from "./templates"
import { uploads } from "./uploads"

export const activityLogsRelations = relations(activityLogs, () => ({}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actorUser: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id]
  })
}))

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects)
}))

export const contractsRelations = relations(contracts, ({ one }) => ({
  project: one(projects, {
    fields: [contracts.projectId],
    references: [projects.id]
  }),
  client: one(clients, {
    fields: [contracts.clientId],
    references: [clients.id]
  }),
  proposal: one(proposals, {
    fields: [contracts.proposalId],
    references: [proposals.id]
  }),
  template: one(templates, {
    fields: [contracts.templateId],
    references: [templates.id]
  })
}))

export const dataExportsRelations = relations(dataExports, ({ one }) => ({
  client: one(clients, {
    fields: [dataExports.clientId],
    references: [clients.id]
  }),
  requestedByUser: one(users, {
    fields: [dataExports.requestedByUserId],
    references: [users.id]
  })
}))

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  template: one(templates, {
    fields: [emailLogs.templateId],
    references: [templates.id]
  })
}))

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id]
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id]
  }),
  proposal: one(proposals, {
    fields: [invoices.proposalId],
    references: [proposals.id]
  }),
  recurringInvoice: one(recurringInvoices, {
    fields: [invoices.recurringInvoiceId],
    references: [recurringInvoices.id]
  }),
  template: one(templates, {
    fields: [invoices.templateId],
    references: [templates.id]
  }),
  lineItems: many(lineItems)
}))

export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  proposal: one(proposals, {
    fields: [lineItems.proposalId],
    references: [proposals.id]
  }),
  invoice: one(invoices, {
    fields: [lineItems.invoiceId],
    references: [invoices.id]
  }),
  taxRate: one(taxRates, {
    fields: [lineItems.taxRateId],
    references: [taxRates.id]
  })
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id]
  }),
  proposals: many(proposals),
  invoices: many(invoices)
}))

export const proposalOtpsRelations = relations(proposalOtps, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalOtps.proposalId],
    references: [proposals.id]
  })
}))

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  project: one(projects, {
    fields: [proposals.projectId],
    references: [projects.id]
  }),
  template: one(templates, {
    fields: [proposals.templateId],
    references: [templates.id]
  }),
  lineItems: many(lineItems),
  proposalOtps: many(proposalOtps),
  invoices: many(invoices),
  contracts: many(contracts)
}))

export const taxRatesRelations = relations(taxRates, ({ many }) => ({
  lineItems: many(lineItems)
}))

export const templatesRelations = relations(templates, ({ many }) => ({
  proposals: many(proposals),
  invoices: many(invoices),
  emailLogs: many(emailLogs)
}))

export const uploadsRelations = relations(uploads, () => ({}))
