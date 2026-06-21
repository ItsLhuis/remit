import { redirect } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { getSession } from "@/lib/auth/session"

import { ScrollArea } from "@/components/ui"

import { AuthPanel, LoginForm } from "@/features/auth"

import { getProfileEmailConfigured } from "@/features/settings/server"

export const metadata: Metadata = { title: t("auth.login.metadataTitle") }

const LoginPage = async () => {
  const [session, passwordResetAvailable] = await Promise.all([
    getSession(),
    getProfileEmailConfigured()
  ])

  if (session) redirect("/setup")

  return (
    <div className="flex h-screen overflow-hidden">
      <AuthPanel />
      <ScrollArea className="bg-background h-full w-full lg:w-2/3">
        <div className="flex min-h-screen flex-col items-center justify-center px-8 py-12">
          <LoginForm passwordResetAvailable={passwordResetAvailable} />
        </div>
      </ScrollArea>
    </div>
  )
}

export default LoginPage
