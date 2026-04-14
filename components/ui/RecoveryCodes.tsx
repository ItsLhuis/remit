"use client"

import { useCopyWithFeedback } from "@/hooks/useCopyWithFeedback"

import { cn } from "@/lib/utils"

import { Alert, AlertDescription } from "@/components/ui/Alert"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { CopyIcon } from "@/components/ui/CopyIcon"
import { Icon } from "@/components/ui/Icon"

type RecoveryCodeButtonProps = {
  code: string
}

const RecoveryCodeButton = ({ code }: RecoveryCodeButtonProps) => {
  const { copied, copy } = useCopyWithFeedback()

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => copy(code)}
      className={cn(
        "w-full justify-between rounded-none font-mono",
        copied && "text-green-600 dark:text-green-400"
      )}
    >
      {code}
      <span className="text-muted-foreground inline-flex items-center opacity-0 transition-opacity group-hover/button:opacity-100 group-focus-visible/button:opacity-100">
        <CopyIcon copied={copied} />
      </span>
    </Button>
  )
}

type RecoveryCodesProps = {
  codes: string[]
  className?: string
}

const RecoveryCodes = ({ codes, className }: RecoveryCodesProps) => {
  const { copied, copy } = useCopyWithFeedback()

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Recovery codes</p>
          <p className="text-muted-foreground text-sm">Save these somewhere safe</p>
        </div>
        <Badge variant="outline">{codes.length} codes</Badge>
      </div>
      <div className="dark:bg-input/30 divide-y overflow-hidden rounded-lg border">
        {Array.from({ length: Math.ceil(codes.length / 2) }, (_, i) => (
          <div key={i} className="grid grid-cols-[1fr_1px_1fr]">
            <RecoveryCodeButton code={codes[i * 2]} />
            <div className="bg-border" />
            {codes[i * 2 + 1] !== undefined && <RecoveryCodeButton code={codes[i * 2 + 1]} />}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => copy(codes.join("\n"))}
      >
        <CopyIcon copied={copied} />
        {copied ? "Copied!" : "Copy all codes"}
      </Button>
      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
        <Icon name="CircleAlert" />
        <AlertDescription className="text-amber-900 dark:text-amber-50">
          Each code can only be used once. Store them offline &mdash; they won&apos;t be shown
          again.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export { RecoveryCodes }
