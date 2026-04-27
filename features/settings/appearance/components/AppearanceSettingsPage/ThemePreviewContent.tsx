import { Fragment } from "react"

const ThemePreviewContent = () => (
  <Fragment>
    <div className="bg-sidebar flex w-9 flex-col gap-1.5 p-2">
      <div className="bg-sidebar-primary h-1.5 w-full rounded-sm" />
      <div className="bg-muted h-1.5 w-full rounded-sm" />
      <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
      <div className="bg-muted h-1.5 w-2/3 rounded-sm" />
    </div>
    <div className="flex flex-1 flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-1.5 w-2/5 rounded-sm" />
        <div className="bg-primary h-2 w-6 rounded-sm" />
      </div>
      <div className="bg-border h-px w-full" />
      <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
      <div className="bg-muted h-1.5 w-1/2 rounded-sm" />
      <div className="bg-muted h-1.5 w-2/3 rounded-sm" />
    </div>
  </Fragment>
)

export { ThemePreviewContent }
