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
  account: {
    modelName: "accounts"
  },
  user: {
    modelName: "users",
    changeEmail: {
      enabled: true
    }
  },
  verification: {
    modelName: "verifications"
  },
  plugins: [
    twoFactorPlugin({
      issuer: "Remit",
      schema: {
        twoFactor: {
          modelName: "two_factors"
        }
      }
    }),
    organizationPlugin({
      schema: {
        organization: {
          modelName: "organizations"
        },
        member: {
          modelName: "members"
        },
        invitation: {
          modelName: "invitations"
        }
      }
    })
  ],
  session: {
    modelName: "sessions",
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60
    }
  }
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
