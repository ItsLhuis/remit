import { type Metadata } from "next"

import { redirect } from "next/navigation"

import { eq } from "drizzle-orm"

import { requireSession } from "@/lib/session"
import { database } from "@/database"
import { settings } from "@/database/schema"

import { ScrollArea } from "@/components/ui"

import { AuthPanel } from "@/features/auth/components"
import { SetupForm } from "@/features/setup/components"

export const metadata: Metadata = { title: "Setup" }

const SetupPage = async () => {
  const session = await requireSession()

  const userSettings = await database.query.settings.findFirst({
    where: eq(settings.userId, session.user.id),
    columns: { businessName: true }
  })

  const businessDone = !!userSettings?.businessName
  const isSetupComplete = businessDone && !!session.user.twoFactorEnabled

  if (isSetupComplete) redirect("/")

  const initialStep = businessDone ? "totp" : "business"

  return (
    <div className="flex h-screen overflow-hidden">
      <AuthPanel />
      <ScrollArea className="bg-background h-full w-full lg:w-2/3">
        <div className="flex min-h-screen flex-col items-center justify-center px-8 py-12">
          <SetupForm initialStep={initialStep} />
        </div>
      </ScrollArea>
    </div>
  )
}

export default SetupPage
