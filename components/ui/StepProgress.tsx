import { type ComponentProps } from "react"

import { Typography } from "./Typography"

type StepProgressProps = ComponentProps<"div"> & {
  label: string
}

const StepProgress = ({ label, className, ...props }: StepProgressProps) => (
  <div data-slot="step-progress" className={className} {...props}>
    <Typography affects="small" className="text-muted-foreground">
      {label}
    </Typography>
  </div>
)

export { StepProgress }
