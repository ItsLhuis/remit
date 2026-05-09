import {
  Badge,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  Typography
} from "@/components/ui"

import { FingerprintCopyButton } from "./FingerprintCopyButton"

import { type HealthCheckResult, type HealthStatus } from "../queries"

type HealthStatusCardProps = {
  check: HealthCheckResult
}

const statusConfig: Record<
  HealthStatus,
  {
    icon: "CircleCheck" | "TriangleAlert" | "CircleX" | "Info"
    className: string
    badgeVariant: "default" | "secondary" | "destructive" | "outline"
    label: string
  }
> = {
  ok: {
    icon: "CircleCheck",
    className: "text-emerald-600 dark:text-emerald-400",
    badgeVariant: "secondary",
    label: "OK"
  },
  warning: {
    icon: "TriangleAlert",
    className: "text-amber-600 dark:text-amber-400",
    badgeVariant: "outline",
    label: "Warning"
  },
  error: {
    icon: "CircleX",
    className: "text-destructive",
    badgeVariant: "destructive",
    label: "Error"
  },
  info: {
    icon: "Info",
    className: "text-sky-600 dark:text-sky-400",
    badgeVariant: "outline",
    label: "Info"
  }
}

const HealthStatusCard = ({ check }: HealthStatusCardProps) => {
  const config = statusConfig[check.status]
  const isFingerprint = check.id === "encryption-key"

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <Icon name={config.icon} className={config.className} />
          <Typography className="min-w-0 truncate" affects="medium">
            {check.title}
          </Typography>
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          <Badge variant={config.badgeVariant}>{config.label}</Badge>
          {isFingerprint && <FingerprintCopyButton fingerprint={check.summary} />}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <Typography
          variant={isFingerprint ? "code" : "p"}
          affects={isFingerprint ? "default" : ["medium", "removePMargin"]}
          className={isFingerprint ? "inline-block" : undefined}
        >
          {check.summary}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {check.detail}
        </Typography>
      </CardContent>
    </Card>
  )
}

export { HealthStatusCard }
