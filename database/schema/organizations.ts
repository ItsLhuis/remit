import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { sql } from "drizzle-orm"

import { users } from "./auth"

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("organization_slug_idx").on(table.slug)]
)

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("member_user_id_idx").on(table.userId),
    index("member_organization_id_idx").on(table.organizationId),
    uniqueIndex("member_user_organization_idx").on(table.userId, table.organizationId),
    uniqueIndex("uq_member_owner_per_org")
      .on(table.organizationId)
      .where(sql`${table.role} = 'owner'`)
  ]
)

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("invitation_email_idx").on(table.email),
    index("invitation_organization_id_idx").on(table.organizationId),
    index("invitation_status_idx").on(table.status)
  ]
)
