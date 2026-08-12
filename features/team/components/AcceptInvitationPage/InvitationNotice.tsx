import Link from "next/link"

import { Button, Typography } from "@/components/ui"

type InvitationNoticeProps = {
  message: string
  actionHref: string
  actionLabel: string
}

const InvitationNotice = ({ message, actionHref, actionLabel }: InvitationNoticeProps) => (
  <div className="flex flex-col items-center gap-4 text-center">
    <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
      {message}
    </Typography>
    <Button asChild size="lg" className="w-full">
      <Link href={actionHref}>{actionLabel}</Link>
    </Button>
  </div>
)

export { InvitationNotice }
