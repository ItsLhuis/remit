"use client"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

import { type PublicProposal } from "../../types"
import { ProposalLineItemsTable } from "../ProposalLineItemsTable"
import { ProposalStatusBadge } from "../ProposalStatusBadge"

import { PublicProposalResponse } from "./PublicProposalResponse"
import { PublicProposalSummary } from "./PublicProposalSummary"

type PublicProposalPageProps = {
  proposal: PublicProposal
  token: string
}

const PublicProposalPage = ({ proposal, token }: PublicProposalPageProps) => {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-8 md:p-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Typography affects={["muted", "small"]}>{t("proposals.public.fromLabel")}</Typography>
          <Typography affects="medium">{proposal.issuer.name}</Typography>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h2" className="font-mono">
            {proposal.number}
          </Typography>
          <ProposalStatusBadge status={proposal.status} />
        </div>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("proposals.public.preparedFor", { name: proposal.preparedForLabel })}
        </Typography>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* `min-w-0` is load-bearing: a grid item defaults to `min-width: auto`, so without it the
        line-items table widens this column to its content and pushes the whole page sideways on a
        phone instead of scrolling inside its own container. */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <ProposalLineItemsTable
            lineItems={proposal.lineItems}
            currency={proposal.currency}
            locale={proposal.locale}
          />
          {proposal.notes ? (
            <div className="flex flex-col gap-2">
              <Typography affects={["small", "medium"]}>
                {t("proposals.detail.notesTitle")}
              </Typography>
              <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
                {proposal.notes}
              </Typography>
            </div>
          ) : null}
          <PublicProposalResponse proposal={proposal} token={token} />
        </div>
        <PublicProposalSummary proposal={proposal} />
      </div>
    </main>
  )
}

export { PublicProposalPage }
