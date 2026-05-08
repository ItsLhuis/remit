import { type Metadata } from "next"

import { redirect } from "next/navigation"

import { t } from "@/lib/i18n/server"

import { getSession } from "@/lib/session"

import { ScrollArea } from "@/components/ui"

import { AuthPanel, LoginForm } from "@/features/auth"

export const metadata: Metadata = { title: t("auth.login.metadataTitle") }

const LoginPage = async () => {
  const session = await getSession()

  if (session) redirect("/setup")

  return (
    <div className="flex h-screen overflow-hidden">
      <AuthPanel />
      <ScrollArea className="bg-background h-full w-full lg:w-2/3">
        <div className="flex min-h-screen flex-col items-center justify-center px-8 py-12">
          <LoginForm />
        </div>
      </ScrollArea>
    </div>
  )
}

export default LoginPage
