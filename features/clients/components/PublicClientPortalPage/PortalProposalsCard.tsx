"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui"

import { ProposalStatusBadge } from "@/features/proposals"

import { type ClientPortalProposal } from "../../types"

import { PortalDocumentRow } from "./PortalDocumentRow"
import { PortalSectionEmpty } from "./PortalSectionEmpty"

type PortalProposalsCardProps = {
  proposals: ClientPortalProposal[]
  locale: string
}

const PortalProposalsCard = ({ proposals, locale }: PortalProposalsCardProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("clients.public.proposals.title")}</CardTitle>
        <CardDescription>{t("clients.public.proposals.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {proposals.length === 0 ? (
          <PortalSectionEmpty
            icon="FileText"
            title={t("clients.public.proposals.emptyTitle")}
            description={t("clients.public.proposals.emptyDescription")}
          />
        ) : (
          <ul className="flex flex-col">
            {proposals.map((proposal) => (
              <PortalDocumentRow
                key={proposal.number}
                number={proposal.number}
                title={null}
                status={<ProposalStatusBadge status={proposal.status} />}
                meta={
                  proposal.validUntil
                    ? t("clients.public.proposals.validUntil", {
                        date: formatDay(proposal.validUntil, locale)
                      })
                    : t("clients.public.proposals.noValidUntil")
                }
                amount={formatCurrency(proposal.totalCents, proposal.currency, locale)}
                link={
                  proposal.documentPath
                    ? {
                        href: proposal.documentPath,
                        label: t("clients.public.proposals.open", { number: proposal.number })
                      }
                    : null
                }
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export { PortalProposalsCard }
