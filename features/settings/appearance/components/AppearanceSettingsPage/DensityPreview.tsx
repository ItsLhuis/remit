type DensityPreviewProps = {
  gap: string
}

const DensityPreview = ({ gap }: DensityPreviewProps) => (
  <div
    className="border-border bg-background flex h-16 w-full flex-col items-start justify-center overflow-hidden rounded-md border px-3"
    style={{ gap }}
  >
    <div className="bg-muted h-1.5 w-full rounded-sm" />
    <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
    <div className="bg-muted h-1.5 w-1/2 rounded-sm" />
  </div>
)

export { DensityPreview }
