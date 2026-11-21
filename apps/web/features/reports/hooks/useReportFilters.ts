"use client"

import { type TransitionStartFunction } from "react"

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"

import { DEFAULT_REPORT, REPORT_KINDS, type ReportFilterId, type ReportKind } from "../schemas"

export type ReportFilterState = {
  report: ReportKind
  from: string
  to: string
  entityIds: Record<ReportFilterId, string>
  hasActiveFilters: boolean
  setReport: (value: ReportKind) => void
  setFrom: (value: string) => void
  setTo: (value: string) => void
  setEntityId: (filter: ReportFilterId, value: string) => void
  reset: () => void
}

// `shallow: false` on purpose: every one of these decides which rows the server aggregates, so the
// URL change has to re-run the server component that reads them rather than settling in the client.
//
// Switching report clears the entity filters. The server drops the ones that report does not offer
// anyway (`scopeReportFilters`), so leaving them in the URL would change nothing about the rows —
// but it would leave a stale id in a control the reader cannot see to clear.
export function useReportFilters(startTransition: TransitionStartFunction): ReportFilterState {
  const sharedOptions = { shallow: false as const, startTransition }

  const [report, setReportValue] = useQueryState(
    "report",
    parseAsStringLiteral(REPORT_KINDS).withDefault(DEFAULT_REPORT).withOptions(sharedOptions)
  )

  const [from, setFrom] = useQueryState(
    "from",
    parseAsString.withDefault("").withOptions(sharedOptions)
  )

  const [to, setTo] = useQueryState("to", parseAsString.withDefault("").withOptions(sharedOptions))

  const [client, setClient] = useQueryState(
    "client",
    parseAsString.withDefault("").withOptions(sharedOptions)
  )

  const [project, setProject] = useQueryState(
    "project",
    parseAsString.withDefault("").withOptions(sharedOptions)
  )

  const [taxRate, setTaxRate] = useQueryState(
    "taxRate",
    parseAsString.withDefault("").withOptions(sharedOptions)
  )

  const entityIds = { client, project, taxRate }
  const hasActiveFilters =
    from !== "" || to !== "" || client !== "" || project !== "" || taxRate !== ""

  const clearEntities = () => {
    void setClient("")
    void setProject("")
    void setTaxRate("")
  }

  const setReport = (value: ReportKind) => {
    clearEntities()
    void setReportValue(value)
  }

  const setEntityId = (filter: ReportFilterId, value: string) => {
    if (filter === "client") void setClient(value)
    if (filter === "project") void setProject(value)
    if (filter === "taxRate") void setTaxRate(value)
  }

  const reset = () => {
    clearEntities()
    void setFrom("")
    void setTo("")
  }

  return {
    report,
    from,
    to,
    entityIds,
    hasActiveFilters,
    setReport,
    setFrom: (value: string) => void setFrom(value),
    setTo: (value: string) => void setTo(value),
    setEntityId,
    reset
  }
}
