import { type Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ScrollArea } from "@/components/ui"

import { AuthPanel } from "../AuthPanel"
import { SetupForm } from "./SetupForm"

export const metadata: Metadata = { title: "Setup" }

const SetupPage = async () => {
  const cookieStore = await cookies()

  if (cookieStore.get("remit_setup")) redirect("/dashboard")

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
