import { betterAuth } from "better-auth"

import { drizzleAdapter } from "better-auth/adapters/drizzle"

import {
  organization as organizationPlugin,
  twoFactor as twoFactorPlugin
} from "better-auth/plugins"

import { env } from "@/lib/env"

import { database } from "@/database"
import {
  accounts,
  invitations,
  members,
  organizations,
  sessions,
  twoFactors,
  users,
  verifications
} from "@/database/schema"

export const auth = betterAuth({
  appName: "Remit",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    database: {
      generateId: () => crypto.randomUUID()
    }
  },
  database: drizzleAdapter(database, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      twoFactor: twoFactors,
      organization: organizations,
      member: members,
      invitation: invitations
    }
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true
  },
  user: {
    changeEmail: {
      enabled: true
    }
  },
  plugins: [
    twoFactorPlugin({
      issuer: "Remit"
    }),
    organizationPlugin()
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60
    }
  },
  rateLimit: {
    enabled: true,
    window: 900,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 900, max: 10 },
      "/sign-up/email": { window: 3600, max: 3 },
      "/request-password-reset": { window: 3600, max: 5 }
    }
  }
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
