import { sql } from "drizzle-orm"
import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { templateType } from "./enums"
import { softDelete, timestamps } from "./helpers"

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
    pageSettings: jsonb("page_settings")
      .notNull()
      .default(sql`'{}'::jsonb`),
    isDefault: boolean("is_default").notNull().default(false),
    isSystem: boolean("is_system").notNull().default(false),
    ...softDelete,
    ...timestamps
  },
  (table) => [
    index("templates_type_idx").on(table.type),
    uniqueIndex("uq_templates_default_per_type")
      .on(table.type)
      .where(sql`${table.isDefault} = true AND ${table.deletedAt} IS NULL`)
  ]
)
