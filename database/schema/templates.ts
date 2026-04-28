import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { emailLogs } from "./emailLogs"
import { templateType } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"
import { proposals } from "./proposals"

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: templateType("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    subject: text("subject"),
    blocks: jsonb("blocks")
      .notNull()
      .default(sql`'[]'::jsonb`),
    isDefault: boolean("is_default").notNull().default(false),
    isSystem: boolean("is_system").notNull().default(false),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("idx_templates_type").on(table.type),
    index("idx_templates_active")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("uq_templates_default_per_type")
      .on(table.type)
      .where(sql`${table.isDefault} = true AND ${table.deletedAt} IS NULL`)
  ]
)

export const templatesRelations = relations(templates, ({ many }) => ({
  proposals: many(proposals),
  invoices: many(invoices),
  emailLogs: many(emailLogs)
}))
