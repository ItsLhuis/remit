import { randomUUID } from "node:crypto"

import { betterAuth } from "better-auth"

import { drizzleAdapter } from "better-auth/adapters/drizzle"

import {
  organization as organizationPlugin,
  twoFactor as twoFactorPlugin
} from "better-auth/plugins"
import { defaultAc, ownerAc } from "better-auth/plugins/organization/access"

import { sendTransactionalEmail } from "@/features/email/server"

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
