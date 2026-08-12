import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { AcceptInvitationPage } from "@/features/team/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: t("team.accept.metadataTitle"),
  robots: { index: false, follow: false }
}

type InvitePageProps = {
  params: Promise<{ invitationId: string }>
}

const InvitePage = async ({ params }: InvitePageProps) => {
  const { invitationId } = await params

  return <AcceptInvitationPage invitationId={invitationId} />
}

export default InvitePage
