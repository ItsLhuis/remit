import { randomUUID } from "node:crypto"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import {
  organization as organizationPlugin,
  twoFactor as twoFactorPlugin
} from "better-auth/plugins"
import { defaultAc, ownerAc } from "better-auth/plugins/organization/access"

import { escapeHtml } from "@/lib/utils"

import { env } from "@/lib/config/env"

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

import { sendTransactionalEmail } from "@/features/email/server"

// Accountant and assistant deliberately share one role with no organization, member, invitation or
// team permissions: Remit runs one organization per instance, so only the owner may ever change
// membership or invite anyone. Feature-level authorization is done by `requireRole` in session.ts,
// not by these Better Auth permissions.
const limitedOrganizationRole = defaultAc.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"]
})

export const auth = betterAuth({
  appName: "Remit",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    database: {
      // Better Auth's own id generator produces short random strings; the auth tables in
      // database/schema are `uuid` columns, so ids must be generated as UUIDs here to be storable.
      generateId: () => randomUUID()
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
    autoSignIn: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthLinkEmail({
        to: user.email,
        subject: "Reset your Remit password",
        intro: "We received a request to reset your Remit password.",
        cta: "Reset password",
        url
      })
    }
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthLinkEmail({
        to: user.email,
        subject: "Verify your Remit email address",
        intro: "Confirm this email address to finish the requested Remit account change.",
        cta: "Verify email address",
        url
      })
    }
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
    organizationPlugin({
      creatorRole: "owner",
      roles: {
        owner: ownerAc,
        accountant: limitedOrganizationRole,
        assistant: limitedOrganizationRole
      }
    })
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // With the cookie cache on, a session read can be up to five minutes stale, which matters for
    // anything reacting to a just-changed session (TOTP enrolment, role change, revocation).
    // `getSession` in session.ts takes `disableCookieCache` for exactly those call sites.
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

type AuthLinkEmail = {
  to: string
  subject: string
  intro: string
  cta: string
  url: string
}

async function sendAuthLinkEmail({ to, subject, intro, cta, url }: AuthLinkEmail): Promise<void> {
  await sendTransactionalEmail({
    to,
    subject,
    text: `${intro}\n\n${cta}: ${url}\n\nIf you did not request this, you can ignore this email.`,
    html: [
      `<p>${escapeHtml(intro)}</p>`,
      `<p><a href="${escapeHtml(url)}">${escapeHtml(cta)}</a></p>`,
      "<p>If you did not request this, you can ignore this email.</p>"
    ].join("\n")
  })
}

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
