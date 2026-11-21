"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { Button, Card, CardContent, CardHeader, CardTitle, Icon, Typography } from "@/components/ui"

import {
  type ProposalAction,
  type ProposalResponseIdentityValues,
  type ProposalStatus
} from "../../schemas"
import { type PublicProposal } from "../../types"

import { PublicProposalCodeForm } from "./PublicProposalCodeForm"
import { PublicProposalIdentityForm } from "./PublicProposalIdentityForm"
import { PublicProposalOutcome } from "./PublicProposalOutcome"

type PublicProposalResponseProps = {
  proposal: PublicProposal
  token: string
}

const PublicProposalResponse = ({ proposal, token }: PublicProposalResponseProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [action, setAction] = useState<ProposalAction | null>(null)
  const [identity, setIdentity] = useState<ProposalResponseIdentityValues | null>(null)
  const [respondedStatus, setRespondedStatus] = useState<ProposalStatus | null>(null)

  const handleVerified = (status: ProposalStatus) => {
    setRespondedStatus(status)

    // The server has already flipped the proposal; refreshing swaps the whole page over to the
    // responded read model, so a reload does not fall back to an accept button that no longer works.
    router.refresh()
  }

  if (respondedStatus) {
    return (
      <PublicProposalOutcome
        status={respondedStatus}
        respondedAt={null}
        rejectionReason={identity?.rejectionReason ?? ""}
        locale={proposal.locale}
        timeZone={proposal.timeZone}
      />
    )
  }

  if (!proposal.canRespond) {
    return (
      <PublicProposalOutcome
        status={proposal.status}
        respondedAt={proposal.respondedAt}
        rejectionReason={proposal.rejectionReason}
        locale={proposal.locale}
        timeZone={proposal.timeZone}
      />
    )
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("proposals.public.respond.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {action === null ? (
          <div className="flex flex-col gap-4">
            <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
              {t("proposals.public.respond.description")}
            </Typography>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => setAction("accept")}>
                <Icon name="CircleCheck" aria-hidden="true" />
                {t("proposals.public.respond.accept")}
              </Button>
              <Button variant="outline" onClick={() => setAction("reject")}>
                <Icon name="CircleX" aria-hidden="true" />
                {t("proposals.public.respond.reject")}
              </Button>
            </div>
          </div>
        ) : identity === null ? (
          <PublicProposalIdentityForm
            action={action}
            token={token}
            onSent={setIdentity}
            onBack={() => setAction(null)}
          />
        ) : (
          <PublicProposalCodeForm
            action={action}
            token={token}
            identity={identity}
            onVerified={handleVerified}
            onBack={() => setIdentity(null)}
          />
        )}
      </CardContent>
    </Card>
  )
}

export { PublicProposalResponse }
