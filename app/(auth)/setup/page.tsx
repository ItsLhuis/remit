import { type Metadata } from "next"

import { redirect } from "next/navigation"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"

import { requireSession } from "@/lib/session"

import { ScrollArea } from "@/components/ui"

import { AuthPanel } from "@/features/auth"
import { SetupForm } from "@/features/setup"

export const metadata: Metadata = { title: t("setup.metadataTitle") }

const SetupPage = async () => {
  const session = await requireSession()

  const userSettings = await database.query.settings.findFirst({
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
