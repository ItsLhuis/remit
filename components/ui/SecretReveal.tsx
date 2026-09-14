"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert"
import { CopyIcon } from "@/components/ui/CopyIcon"
import { Icon } from "@/components/ui/Icon"
import { IconButton } from "@/components/ui/IconButton"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"

import { useCopyWithFeedback } from "@/hooks"

type SecretRevealProps = {
  id: string
  label: string
  value: string
  warningTitle: string
  warningDescription: string
  copyLabel: string
  copiedLabel: string
}

// The one-time reveal of a credential the server will never show again — an API token, a webhook
// signing secret. The warning sits above the value so it is read before the copy, the field selects
// itself on focus so a keyboard user can copy without the button, and the copy outcome is announced
// because the button's own feedback is a tooltip a screen reader does not reach.
const SecretReveal = ({
  id,
  label,
  value,
  warningTitle,
  warningDescription,
  copyLabel,
  copiedLabel
}: SecretRevealProps) => {
  const { copied, copy } = useCopyWithFeedback()

  return (
    <div data-slot="secret-reveal" className="flex flex-col gap-4">
      <Alert>
        <Icon name="TriangleAlert" aria-hidden="true" />
        <AlertTitle>{warningTitle}</AlertTitle>
        <AlertDescription>{warningDescription}</AlertDescription>
      </Alert>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            readOnly
            value={value}
            className="font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          <IconButton
            variant="outline"
            label={copyLabel}
            tooltip={copied ? copiedLabel : copyLabel}
            onClick={() => void copy(value)}
          >
            <CopyIcon copied={copied} />
          </IconButton>
        </div>
        <span className="sr-only" aria-live="polite">
          {copied ? copiedLabel : ""}
        </span>
      </div>
    </div>
  )
}

export { SecretReveal }
