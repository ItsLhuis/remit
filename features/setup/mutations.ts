"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { logger } from "@/lib/logger"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { businessProfileSchema } from "./schemas"

export async function saveBusinessProfile(
  input: unknown
): Promise<{ data: { success: true } } | { error: string }> {
  const requestHeaders = await headers()

  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const parsed = businessProfileSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { businessName, businessEmail, businessTaxId, businessCountry, defaultCurrency } =
    parsed.data

  try {
    const existing = await database.query.settings.findFirst()

    if (existing) {
      await database
        .update(settings)
        .set({
          businessName,
          businessEmail: businessEmail || null,
          businessTaxId: businessTaxId || null,
          businessCountry,
          defaultCurrency
        })
        .where(eq(settings.id, existing.id))
    } else {
      await database.insert(settings).values({
        businessName,
        businessEmail: businessEmail || null,
        businessTaxId: businessTaxId || null,
        businessCountry,
        defaultCurrency
      })
    }

    await ensureOwnerMembership({
      headers: requestHeaders,
      businessName
    })
  } catch (error) {
    logger.error(
      { action: "saveBusinessProfile", userId: session.user.id, err: error },
      "Business profile write failed"
    )

    return { error: t("errors.somethingWentWrong") }
  }

  revalidatePath("/setup")
  revalidatePath("/")

  return { data: { success: true } }
}

type EnsureOwnerMembershipInput = {
  headers: Headers
  businessName: string
}

async function ensureOwnerMembership({
  headers,
  businessName
}: EnsureOwnerMembershipInput): Promise<void> {
  // Read-only setup gate: Better Auth has no single-instance organization lookup helper.
  const existingOrganization = await database.query.organizations.findFirst({
    columns: { id: true }
  })

  if (!existingOrganization) {
    const organization = await auth.api.createOrganization({
      headers,
      body: {
        name: businessName,
        slug: createOrganizationSlug(businessName)
      }
    })

    await auth.api.setActiveOrganization({
      headers,
      body: {
        organizationId: organization.id
      }
    })

    return
  }

  await auth.api.setActiveOrganization({
    headers,
    body: {
      organizationId: existingOrganization.id
    }
  })

  const activeMemberRole = await auth.api.getActiveMemberRole({
    headers,
    query: {
      organizationId: existingOrganization.id
    }
  })

  if (activeMemberRole.role !== "owner") {
    throw new Error("Setup user is not the organization owner")
  }
}

function createOrganizationSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "remit"
}
