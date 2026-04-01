import { type Metadata } from "next"
import { redirect } from "next/navigation"

import { eq } from "drizzle-orm"

import { requireSession } from "@/lib/session"
import { database } from "@/database"
import { settings } from "@/database/schema"

import { ScrollArea } from "@/components/ui"

import { AuthPanel } from "../AuthPanel"
import { SetupForm } from "./SetupForm"

export const metadata: Metadata = { title: "Setup" }

const SetupPage = async () => {
  const session = await requireSession()

  const userSettings = await database.query.settings.findFirst({
    where: eq(settings.userId, session.user.id),
    columns: { businessName: true }
  })

  const isSetupComplete = !!(userSettings?.businessName && session.user.twoFactorEnabled)

  if (isSetupComplete) redirect("/dashboard")

  return (
    <div className="flex h-screen overflow-hidden">
      <AuthPanel />
      <ScrollArea className="h-full w-full bg-background lg:w-2/3">
        <div className="flex min-h-screen flex-col items-center justify-center px-8 py-12">
          <SetupForm />
        </div>
      </ScrollArea>
    </div>
  )
}

export default SetupPage
