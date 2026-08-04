"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCompactCurrency, formatCompactNumber } from "@/lib/utils"

import { Typography } from "@/components/ui"

import { type ClientsSummary } from "../../services"

const OUTSTANDING_RAMP = ["var(--chart-5)", "var(--chart-4)", "var(--chart-3)", "var(--chart-2)"]

type OutstandingBreakdownProps = {
  items: ClientsSummary["outstandingByCurrency"]
  owingClients: number
  locale: string
}

const OutstandingBreakdown = ({ items, owingClients, locale }: OutstandingBreakdownProps) => {
  const { t } = useTranslation()

  if (items.length <= 1) {
    return (
      <div className="mt-auto flex items-baseline justify-between gap-2 border-t pt-3">
        <Typography affects={["muted", "tiny"]}>{t("clients.summary.owingClients")}</Typography>
        <span className="font-mono text-sm font-medium tabular-nums">
          {formatCompactNumber(owingClients, locale)}
        </span>
      </div>
    )
  }

  // Minor units summed across different currencies, which is meaningless as money and is only ever
  // a denominator for the ribbon widths below — the bar is `aria-hidden` and each segment prints
  // its own amount with its own currency code. Nothing derived from this is shown to the user, so
  // it does not become the mixed-currency total that ADR-0009 exists to prevent.
  const total = items.reduce((sum, item) => sum + item.totalCents, 0)

  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className="bg-muted flex h-2 overflow-hidden rounded-full" aria-hidden="true">
        {items.slice(0, 4).map((item, index) => (
          <div
            key={item.currency}
            className="h-full"
            style={{
              width: total > 0 ? `${(item.totalCents / total) * 100}%` : "0%",
              backgroundColor: OUTSTANDING_RAMP[index % OUTSTANDING_RAMP.length]
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.slice(0, 3).map((item, index) => (
          <div key={item.currency} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: OUTSTANDING_RAMP[index % OUTSTANDING_RAMP.length] }}
              aria-hidden="true"
            />
            <Typography affects={["muted", "tiny"]}>
              {item.currency} {formatCompactCurrency(item.totalCents, item.currency, locale)}
            </Typography>
          </div>
        ))}
      </div>
    </div>
  )
}

export { OutstandingBreakdown }
