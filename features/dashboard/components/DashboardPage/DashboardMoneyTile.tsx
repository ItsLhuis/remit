"use client"

import { type ComponentProps } from "react"

import Link from "next/link"

import { formatCompactCurrency, formatCurrency } from "@/lib/utils"

import { Button, type Icon, StatCard, StatValue } from "@/components/ui"

type DashboardMoneyTileAction = {
  label: string
  href: string
}

type DashboardMoneyTileProps = {
  icon: ComponentProps<typeof Icon>["name"]
  label: string
  cents: number
  currency: string
  locale: string
  hint: string
  emptyHint: string
  isEmpty: boolean
  action?: DashboardMoneyTileAction
}

// The tile owns what an empty tile looks like — its own hint and, when the zero suggests something
// to do, the link that does it — so the band above it stays a list of five figures rather than five
// copies of the same branch. A zero that is good news (nothing overdue) simply passes no action.
//
// The compact value is what the tile shows and the full amount is its `title`, so a figure that
// rounds to "€12K" still exposes the exact cents on hover; the Tabular Figure rule in DESIGN.md is
// what keeps the digits aligned across the row.
const DashboardMoneyTile = ({
  icon,
  label,
  cents,
  currency,
  locale,
  hint,
  emptyHint,
  isEmpty,
  action
}: DashboardMoneyTileProps) => (
  <StatCard icon={icon} label={label}>
    <StatValue
      value={formatCompactCurrency(cents, currency, locale)}
      title={formatCurrency(cents, currency, locale)}
      hint={isEmpty ? emptyHint : hint}
      mono
    />
    {isEmpty && action ? (
      <Button asChild variant="outline" size="sm" className="mt-auto self-start">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    ) : null}
  </StatCard>
)

export { DashboardMoneyTile }
