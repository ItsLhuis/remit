"use client"

import { useCopyWithFeedback } from "@/hooks/useCopyWithFeedback"

import { Button, CopyIcon, Typography } from "@/components/ui"

type ManualEntryCodeProps = {
  secret: string
}

const ManualEntryCode = ({ secret }: ManualEntryCodeProps) => {
  const { copied: isSecretCopied, copy: copySecret } = useCopyWithFeedback()

  return (
    <div className="dark:bg-input/30 rounded-lg border p-3">
      <Typography affects={["small", "muted"]}>Manual entry code</Typography>
      <div className="mt-1 flex items-center gap-3">
        <Typography
          variant="p"
          affects={["bold", "removePMargin"]}
          className="min-w-0 flex-1 font-mono break-all"
          title={secret}
        >
          {secret}
        </Typography>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => copySecret(secret)}
        >
          <CopyIcon copied={isSecretCopied} />
        </Button>
      </div>
    </div>
  )
}

export { ManualEntryCode }
