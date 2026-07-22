import { redirect } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireSession } from "@/lib/auth/session"

import { ScrollArea } from "@/components/ui"

import { AuthPanel } from "@/features/auth"

import { SetupForm } from "@/features/setup"
import { getSetupProgress } from "@/features/setup/server"

export const metadata: Metadata = { title: t("setup.metadataTitle") }

const SetupPage = async () => {
  const session = await requireSession()

  const setupProgress = await getSetupProgress(Boolean(session.user.twoFactorEnabled))

  if (setupProgress.isComplete) redirect("/")

  return (
    <div className="flex h-dvh overflow-hidden">
      <AuthPanel />
      <ScrollArea className="bg-background h-full w-full lg:w-2/3">
        <div className="flex min-h-dvh flex-col items-center justify-center px-8 py-12">
          <SetupForm initialStep={setupProgress.initialStep} />
        </div>
      </ScrollArea>
    </div>
  )
}

export default SetupPage
