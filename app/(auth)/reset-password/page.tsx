import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ScrollArea } from "@/components/ui"

import { AuthPanel, ResetPasswordForm } from "@/features/auth"

export const metadata: Metadata = { title: t("auth.resetPassword.metadataTitle") }

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string | string[]
    error?: string | string[]
  }>
}

const ResetPasswordPage = async ({ searchParams }: ResetPasswordPageProps) => {
  const params = await searchParams
  const token = typeof params.token === "string" ? params.token : null

  return (
    <div className="flex h-dvh overflow-hidden">
      <AuthPanel />
      <ScrollArea className="bg-background h-full w-full lg:w-2/3">
        <div className="flex min-h-dvh flex-col items-center justify-center px-8 py-12">
          <ResetPasswordForm token={token} />
        </div>
      </ScrollArea>
    </div>
  )
}

export default ResetPasswordPage
