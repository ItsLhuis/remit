"use client"

import { useTranslation } from "@/lib/i18n"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, Icon } from "@/components/ui"

// The single surface behind every dead-end on `/p/[token]`: an unknown token, a withdrawn
// proposal, a dead project, a link past its validity window, and a server fault all render exactly
// this. Adding a case-specific message here would undo the whole point — see `getPublicProposal`.
const PublicProposalUnavailable = () => {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty className="ring-foreground/10 max-w-md rounded-xl ring-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="FileQuestionMark" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("proposals.public.unavailable.title")}</EmptyTitle>
          <EmptyDescription>{t("proposals.public.unavailable.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  )
}

export { PublicProposalUnavailable }
