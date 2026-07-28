import { notFound } from "next/navigation"

import { type Metadata } from "next"
import Link from "next/link"

import { t } from "@/lib/i18n/server"

import { Button, Icon, ScrollArea, SidebarTrigger, Typography } from "@/components/ui"

import { ProposalForm } from "@/features/proposals"
import { getProposalEditorData } from "@/features/proposals/server"

export const metadata: Metadata = {
  title: t("proposals.metadata.create")
}

type NewProposalRouteProps = {
  params: Promise<{ projectId: string }>
}

const NewProposalRoute = async ({ params }: NewProposalRouteProps) => {
  const { projectId } = await params

  const editor = await getProposalEditorData({ projectId })

  if (!editor) notFound()

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/projects/${projectId}/proposals`}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("proposals.form.backToList")}
            </Link>
          </Button>
        </div>
        <header className="space-y-1">
          <div className="flex items-center gap-3">
            <Typography variant="h2">{t("proposals.form.createTitle")}</Typography>
          </div>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("proposals.form.createDescription")}
          </Typography>
        </header>
        <ProposalForm editor={editor} proposal={null} />
      </div>
    </ScrollArea>
  )
}

export default NewProposalRoute
