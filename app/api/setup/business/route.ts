import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { eq } from "drizzle-orm"

import { auth } from "@/lib/auth"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { businessProfileSchema } from "@/app/(auth)/setup/schemas"

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  const result = businessProfileSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: result.error.flatten((issue) => issue.message).fieldErrors
      },
      { status: 400 }
    )
  }

  const { businessName, businessEmail, businessTaxId, businessCountry, defaultCurrency } =
    result.data

  const existing = await database.query.settings.findFirst({
    where: eq(settings.userId, session.user.id)
  })

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
      .where(eq(settings.userId, session.user.id))
  } else {
    await database.insert(settings).values({
      userId: session.user.id,
      businessName,
      businessEmail: businessEmail || null,
      businessTaxId: businessTaxId || null,
      businessCountry,
      defaultCurrency
    })
  }

  return NextResponse.json({ success: true })
}
