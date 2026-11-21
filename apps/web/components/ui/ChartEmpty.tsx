import { Typography } from "./Typography"

type ChartEmptyProps = {
  label: string
}

const ChartEmpty = ({ label }: ChartEmptyProps) => (
  <div className="mt-auto flex h-14 w-full items-center" aria-hidden="true">
    <div className="bg-border relative h-px w-full">
      <Typography
        affects={["muted", "tiny"]}
        className="bg-card absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 whitespace-nowrap"
      >
        {label}
      </Typography>
    </div>
  </div>
)

export { ChartEmpty }
