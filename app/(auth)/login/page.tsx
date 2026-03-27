import { type Metadata } from "next"
import { redirect } from "next/navigation"

import { getSession } from "@/lib/session"

import { LoginPanel } from "./LoginPanel"
import { LoginForm } from "./LoginForm"

export const metadata: Metadata = { title: "Sign in" }

const LoginPage = async () => {
  const session = await getSession()
  if (session) redirect("/dashboard")

  return (
    <div className="flex min-h-screen">
      <LoginPanel />
      <div className="flex w-full flex-col items-center justify-center bg-background px-8 py-12 lg:w-2/3">
        <LoginForm />
      </div>
    </div>
  )
}

export default LoginPage
