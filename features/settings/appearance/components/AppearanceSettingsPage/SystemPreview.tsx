const SystemPreview = () => (
  <div className="border-border flex h-20 w-full overflow-hidden rounded-md border">
    <div className="dark bg-background flex flex-1 flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-1.5 w-2/5 rounded-sm" />
        <div className="bg-primary h-2 w-5 rounded-sm" />
      </div>
      <div className="bg-border h-px w-full" />
      <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
      <div className="bg-muted h-1.5 w-1/2 rounded-sm" />
      <div className="bg-muted h-1.5 w-2/3 rounded-sm" />
    </div>
    <div className="light bg-background flex flex-1 flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-1.5 w-2/5 rounded-sm" />
        <div className="bg-primary h-2 w-5 rounded-sm" />
      </div>
      <div className="bg-border h-px w-full" />
      <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
      <div className="bg-muted h-1.5 w-1/2 rounded-sm" />
      <div className="bg-muted h-1.5 w-2/3 rounded-sm" />
    </div>
  </div>
)

export { SystemPreview }
