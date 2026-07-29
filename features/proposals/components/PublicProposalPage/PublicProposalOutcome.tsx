"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import { Alert, AlertDescription, AlertTitle, Icon, Typography } from "@/components/ui"

import { type ProposalStatus } from "../../schemas"

type PublicProposalOutcomeProps = {
  status: ProposalStatus
  respondedAt: Date | null
  rejectionReason: string
  locale: string
  timeZone: string
}

const PublicProposalOutcome = ({
  status,
  respondedAt,
  rejectionReason,
  locale,
  timeZone
}: PublicProposalOutcomeProps) => {
  const { t } = useTranslation()

  const isAccepted = status === "accepted"

  return (
    <Alert variant={isAccepted ? "default" : "destructive"}>
      <Icon name={isAccepted ? "CircleCheck" : "CircleX"} aria-hidden="true" />
      <AlertTitle>
        {isAccepted
          ? t("proposals.public.outcome.acceptedTitle")
          : t("proposals.public.outcome.rejectedTitle")}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <Typography variant="p" affects={["small", "removePMargin"]}>
          {isAccepted
            ? t("proposals.public.outcome.acceptedDescription")
            : t("proposals.public.outcome.rejectedDescription")}
        </Typography>
        {respondedAt ? (
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("proposals.public.outcome.respondedAt", {
              date: formatDate(respondedAt, { locale, timeZone })
            })}
          </Typography>
        ) : null}
        {rejectionReason ? (
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("proposals.public.outcome.reasonLabel")}: {rejectionReason}
          </Typography>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

export { PublicProposalOutcome }
