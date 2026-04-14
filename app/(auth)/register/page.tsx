import { type Metadata } from "next"

import { redirect } from "next/navigation"

import { database } from "@/database"
import { getSession } from "@/lib/session"

import { ScrollArea } from "@/components/ui"

import { AuthPanel, RegisterForm } from "@/features/auth/components"

export const metadata: Metadata = { title: "Register" }

const RegisterPage = async () => {
  const existingUser = await database.query.user.findFirst({ columns: { id: true } })

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
