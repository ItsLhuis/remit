"use client"

import { type ReactNode, useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import { Icon, ScrollArea, SidebarTrigger, Typography } from "@/components/ui"

import { DashboardPeriodToggle } from "./DashboardPeriodToggle"

type DashboardShellProps = {
  children: ReactNode
}

// The dashboard layout is `h-svh overflow-hidden` (app/(dashboard)/layout.tsx), so a page that does
// not bring its own scroll container simply cannot scroll. Every list page opens with
// `<ScrollArea className="size-full">` for exactly this reason; this is the same shell.
//
// The header wraps on space rather than on a breakpoint. `basis-72` is the width the title block
// asks for, so the period control keeps its full width and drops onto its own line the moment the
// two no longer fit, at whatever viewport that happens to be; `ml-auto` on the control keeps it
// right-aligned on that second line as well as beside the title.
//
// The shell owns the period control and the transition it starts, so the header paints in the first
// response while the body streams behind its own Suspense boundary. Keeping the control here also
// keeps the pending state visible: `useTransition` holds the previous body on screen while the next
// period is fetched, rather than replacing the page with a skeleton on every switch.
const DashboardShell = ({ children }: DashboardShellProps) => {
  const { t } = useTranslation()

  const [isPending, startTransition] = useTransition()

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <header className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div className="min-w-0 flex-1 basis-72 space-y-1">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <Icon
                name="LayoutDashboard"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("dashboard.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("dashboard.description")}
            </Typography>
          </div>
          <DashboardPeriodToggle isPending={isPending} startTransition={startTransition} />
        </header>
        <div
          aria-busy={isPending}
          className="min-w-0 transition-opacity duration-200 ease-out data-pending:opacity-60"
          data-pending={isPending ? "" : undefined}
        >
          {children}
        </div>
      </div>
    </ScrollArea>
  )
}

export { DashboardShell }
