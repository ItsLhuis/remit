import { Fade } from "@/components/ui/Fade"
import { Icon } from "@/components/ui/Icon"

type CopyIconProps = {
  copied: boolean
}

const CopyIcon = ({ copied }: CopyIconProps) => {
  return (
    <span data-slot="copy-icon" className="relative inline-flex size-4 items-center justify-center">
      <Fade as="span" show={!copied} initial={false} unmountOnExit={false} className="absolute">
        <Icon name="Copy" />
      </Fade>
      <Fade as="span" show={copied} initial={false} unmountOnExit={false} className="absolute">
        <Icon name="Check" />
      </Fade>
    </span>
  )
}

export { CopyIcon }
