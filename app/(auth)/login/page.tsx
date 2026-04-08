import { type Metadata } from "next"

import { redirect } from "next/navigation"

import { ScrollArea } from "@/components/ui"
import { getSession } from "@/lib/session"

import { AuthPanel } from "../AuthPanel"
import { LoginForm } from "./LoginForm"

export const metadata: Metadata = { title: "Sign in" }

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
