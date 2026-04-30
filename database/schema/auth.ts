import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { sql } from "drizzle-orm"

import { organizations } from "./organizations"

const authTimestamp = {
  withTimezone: true,
  mode: "date"
} as const

export const users = pgTable("users", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at", authTimestamp).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", authTimestamp)
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull()
})

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", authTimestamp).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", authTimestamp).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", authTimestamp)
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    activeOrganizationId: uuid("active_organization_id").references(() => organizations.id, {
      onDelete: "set null"
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
)

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", authTimestamp),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", authTimestamp),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", authTimestamp).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", authTimestamp)
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull()
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)]
)

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", authTimestamp).notNull(),
    createdAt: timestamp("created_at", authTimestamp).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", authTimestamp)
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull()
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)]
)

export const twoFactors = pgTable(
  "two_factors",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
  },
  (table) => [
    index("two_factors_user_id_idx").on(table.userId),
    index("two_factors_secret_idx").on(table.secret)
  ]
)
