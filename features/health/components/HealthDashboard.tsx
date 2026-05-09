import { Typography } from "@/components/ui"

import { HealthStatusCard } from "./HealthStatusCard"

import { type HealthCheckResult } from "../queries"

type HealthDashboardProps = {
  checks: HealthCheckResult[]
}

const HealthDashboard = ({ checks }: HealthDashboardProps) => {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <header className="space-y-2">
        <Typography variant="h2">Health</Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Operational checks for this Remit instance.
        </Typography>
      </header>
      <section className="grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <HealthStatusCard key={check.id} check={check} />
        ))}
      </section>
    </main>
  )
}

export { HealthDashboard }
