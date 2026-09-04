"use client"

import { CopyIcon } from "@/components/ui/CopyIcon"
import { IconButton } from "@/components/ui/IconButton"
import { Input } from "@/components/ui/Input"

import { useCopyWithFeedback } from "@/hooks"

type CopyLinkFieldProps = {
  path: string
  label: string
  copyLabel: string
  copiedLabel: string
}

// Shows the path and copies the absolute URL, because the path is what stays readable in a narrow
// card and the URL is what a recipient can open. The origin is read inside the handler rather than
// during render: this component is server-rendered first, where `window` does not exist.
const CopyLinkField = ({ path, label, copyLabel, copiedLabel }: CopyLinkFieldProps) => {
  const { copied, copy } = useCopyWithFeedback()

  return (
    <div data-slot="copy-link-field" className="flex items-center gap-2">
      <Input readOnly value={path} aria-label={label} />
      <IconButton
        variant="outline"
        label={copyLabel}
        tooltip={copied ? copiedLabel : copyLabel}
        onClick={() => void copy(`${window.location.origin}${path}`)}
      >
        <CopyIcon copied={copied} />
      </IconButton>
    </div>
  )
}

export { CopyLinkField }
