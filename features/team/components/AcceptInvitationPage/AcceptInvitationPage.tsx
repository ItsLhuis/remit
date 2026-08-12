import Image from "next/image"

import { t } from "@/lib/i18n/server"

import { ScrollArea, Typography } from "@/components/ui"

import { AuthPanel } from "@/features/auth"

import { getInvitationPreview } from "../../queries"

import { AcceptInvitationForm } from "./AcceptInvitationForm"
import { InvitationNotice } from "./InvitationNotice"

type AcceptInvitationPageProps = {
  invitationId: string
}

const AcceptInvitationPage = async ({ invitationId }: AcceptInvitationPageProps) => {
  const preview = await getInvitationPreview({ invitationId })

  return (
    <div className="flex h-dvh overflow-hidden">
      <AuthPanel />
      <ScrollArea className="bg-background h-full w-full lg:w-2/3">
        <div className="flex min-h-dvh flex-col items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center text-center">
              <Image
                src="/logo.png"
                alt={t("app.logoAlt")}
                width={64}
                height={64}
                className="mb-4"
              />
              <Typography variant="h2" className="mb-2">
                {t("team.accept.title")}
              </Typography>
              <Typography variant="p" affects={["muted", "removePMargin"]}>
                {preview
                  ? t("team.accept.description", { organization: preview.organizationName })
                  : t("team.accept.invalidDescription")}
              </Typography>
            </div>
            {!preview ? (
              <InvitationNotice
                message={t("team.accept.invalidMessage")}
                actionHref="/login"
                actionLabel={t("team.accept.goToLogin")}
              />
            ) : preview.isAlreadyMember ? (
              <InvitationNotice
                message={t("team.accept.alreadyMemberMessage")}
                actionHref="/"
                actionLabel={t("team.accept.goToDashboard")}
              />
            ) : (
              <AcceptInvitationForm preview={preview} />
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

export { AcceptInvitationPage }
