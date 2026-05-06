import { headers } from "next/headers"

import { NextResponse } from "next/server"

import { eq } from "drizzle-orm"

import { z } from "zod"

import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { businessProfileSchema } from "@/features/setup"

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 })
  }

  const body = await request.json()

  const result = businessProfileSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      {
        error: t("errors.validationFailed"),
        issues: z.treeifyError(result.error)
      },
      { status: 400 }
    )
  }

  const { businessName, businessEmail, businessTaxId, businessCountry, defaultCurrency } =
    result.data

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

  return NextResponse.json({ success: true })
}
