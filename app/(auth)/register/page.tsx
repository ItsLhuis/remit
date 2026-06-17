import { redirect } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { getSession } from "@/lib/auth/session"

import { ScrollArea } from "@/components/ui"

import { AuthPanel, RegisterForm } from "@/features/auth"
import { hasRegisteredUser } from "@/features/auth/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: t("auth.register.metadataTitle") }

const RegisterPage = async () => {
  // Read-only bootstrap gate: registration is open only until the first Better Auth user exists.
  const existingUser = await hasRegisteredUser()

  if (existingUser) {
    const session = await getSession()

    redirect(session ? "/setup" : "/login")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AuthPanel />
      <ScrollArea className="bg-background h-full w-full lg:w-2/3">
        <div className="flex min-h-screen flex-col items-center justify-center px-8 py-12">
          <RegisterForm />
        </div>
      </ScrollArea>
    </div>
  )
}

export default RegisterPage
