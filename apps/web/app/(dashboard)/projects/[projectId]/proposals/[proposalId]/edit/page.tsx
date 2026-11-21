import { notFound, redirect } from "next/navigation"

import { type Metadata } from "next"
import Link from "next/link"

import { t } from "@/lib/i18n/server"

import { Button, Icon, ScrollArea, SidebarTrigger, Typography } from "@/components/ui"

import { isProposalEditable, ProposalForm } from "@/features/proposals"
import { getProposalEditorData, getProposalForEdit } from "@/features/proposals/server"

export const metadata: Metadata = {
  title: t("proposals.metadata.edit")
}

type EditProposalRouteProps = {
  params: Promise<{ projectId: string; proposalId: string }>
}

const EditProposalRoute = async ({ params }: EditProposalRouteProps) => {
  const { projectId, proposalId } = await params

  const [editor, proposal] = await Promise.all([
    getProposalEditorData({ projectId }),
    getProposalForEdit({ id: proposalId })
  ])

  if (!editor || !proposal) notFound()

  // The server action rejects a non-draft write on its own; this only keeps the route from rendering
  // a form whose every submission would fail.
  if (!isProposalEditable(proposal.status)) {
    redirect(`/projects/${projectId}/proposals/${proposalId}`)
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/projects/${projectId}/proposals/${proposalId}`}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("proposals.form.backToProposal")}
            </Link>
          </Button>
        </div>
        <header className="space-y-1">
          <div className="flex items-center gap-3">
            <Typography variant="h2">{t("proposals.form.editTitle")}</Typography>
          </div>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("proposals.form.editDescription")}
          </Typography>
        </header>
        <ProposalForm editor={editor} proposal={proposal} />
      </div>
    </ScrollArea>
  )
}

export default EditProposalRoute
