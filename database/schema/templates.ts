import { boolean, index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { user } from "./auth"
import { emailLogs } from "./emailLogs"
import { templateType } from "./enums"
import { softDelete, timestamps } from "./helpers"
import { invoices } from "./invoices"
import { proposals } from "./proposals"

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    index("idx_templates_user_id").on(table.userId),
    index("idx_templates_type").on(table.type),
    index("idx_templates_active")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_templates_type_default")
      .on(table.userId, table.type)
      .where(sql`${table.isDefault} = true`)
  ]
)

export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(user, {
    fields: [templates.userId],
    references: [user.id]
  }),
  proposals: many(proposals),
  invoices: many(invoices),
  emailLogs: many(emailLogs)
}))
