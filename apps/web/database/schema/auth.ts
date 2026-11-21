import { sql } from "drizzle-orm"
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

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
  mustChangePassword: boolean("must_change_password").notNull().default(false),
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
    // Better Auth's organization plugin declares this as a plain optional string with no
    // `references` (unlike members.userId and invitations.inviterId, which do declare one), and the
    // installed version is the schema contract for these tables. Adding a foreign key here would
    // also make organizations.ts and this file import each other.
    activeOrganizationId: uuid("active_organization_id"),
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
      .references(() => users.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until", authTimestamp)
  },
  (table) => [
    index("two_factors_user_id_idx").on(table.userId),
    index("two_factors_secret_idx").on(table.secret)
  ]
)
