import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireSession } from "@/lib/auth/session"

import { ScrollArea } from "@/components/ui"

import { AuthPanel, ChangePasswordForm } from "@/features/auth"

export const metadata: Metadata = { title: t("auth.changePassword.metadataTitle") }

const ChangePasswordPage = async () => {
  await requireSession()

  return (
    <div className="flex h-screen overflow-hidden">
      <AuthPanel />
      <ScrollArea className="bg-background h-full w-full lg:w-2/3">
        <div className="flex min-h-screen flex-col items-center justify-center px-8 py-12">
          <ChangePasswordForm />
        </div>
      </ScrollArea>
    </div>
  )
}

export default ChangePasswordPage
