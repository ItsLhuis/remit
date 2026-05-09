"use client"

import { useCopyWithFeedback } from "@/hooks/useCopyWithFeedback"

import { Button, CopyIcon, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"

type FingerprintCopyButtonProps = {
  fingerprint: string
}

const FingerprintCopyButton = ({ fingerprint }: FingerprintCopyButtonProps) => {
  const { copied, copy } = useCopyWithFeedback()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => copy(fingerprint)}
          aria-label="Copy encryption key fingerprint"
        >
          <CopyIcon copied={copied} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Copy fingerprint"}</TooltipContent>
    </Tooltip>
  )
}

export { FingerprintCopyButton }
