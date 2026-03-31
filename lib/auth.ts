import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { twoFactor as twoFactorPlugin } from "better-auth/plugins"

import { database } from "@/database"
import { account, session, twoFactor, user, verification } from "@/database/schema"

export const auth = betterAuth({
  appName: "Remit",
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  advanced: {
    database: {
      generateId: "uuid"
    }
  },
  database: drizzleAdapter(database, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
      twoFactor
    }
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true
  },
  plugins: [
    twoFactorPlugin({
      issuer: "Remit"
    })
  ],
  session: {
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
