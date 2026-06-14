import { type ComponentProps, type ReactNode } from "react"

import { cn } from "@/lib/utils"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Icon } from "@/components/ui/Icon"
import { Typography } from "@/components/ui/Typography"

type StatCardProps = {
  icon: ComponentProps<typeof Icon>["name"]
  label: string
  children: ReactNode
}

const StatCard = ({ icon, label, children }: StatCardProps) => (
  <Card data-slot="stat-card" className="h-full">
    <CardHeader>
      <CardTitle>
        <Typography affects={["muted", "small", "medium"]}>{label}</Typography>
      </CardTitle>
      <CardAction>
        <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
          <Icon name={icon} aria-hidden="true" />
        </div>
      </CardAction>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3">{children}</CardContent>
  </Card>
)

type StatValueProps = {
  value: string
  title: string
  hint: string
  mono?: boolean
}

const StatValue = ({ value, title, hint, mono }: StatValueProps) => (
  <div data-slot="stat-value" className="flex flex-col gap-0.5">
    <span
      title={title}
      className={cn(
        "text-foreground text-2xl font-semibold tracking-tight",
        mono && "font-mono tabular-nums"
      )}
    >
      {value}
    </span>
    <Typography affects={["muted", "tiny"]}>{hint}</Typography>
  </div>
)

export { StatCard, StatValue }
