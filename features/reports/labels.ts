import { type ReportFilterId, type ReportKind } from "./schemas"
import { type ReportColumnId } from "./services"

type ReportPresentation = {
  titleKey: string
  descriptionKey: string
  icon: "Users" | "FolderOpen" | "CalendarRange" | "Percent" | "Clock" | "Wallet" | "Landmark"
}

// The translation key rather than the string, because a report's name is read on the server (page
// metadata, CSV headers, the audit snapshot) and in the client, and only the caller knows which `t`
// it holds. Keys are literal types, so the compiler still rejects one that `Translations` lacks.
export const reportPresentation = {
  revenueByClient: {
    titleKey: "reports.kinds.revenueByClient.title",
    descriptionKey: "reports.kinds.revenueByClient.description",
    icon: "Users"
  },
  revenueByProject: {
    titleKey: "reports.kinds.revenueByProject.title",
    descriptionKey: "reports.kinds.revenueByProject.description",
    icon: "FolderOpen"
  },
  revenueByMonth: {
    titleKey: "reports.kinds.revenueByMonth.title",
    descriptionKey: "reports.kinds.revenueByMonth.description",
    icon: "CalendarRange"
  },
  revenueByTaxRate: {
    titleKey: "reports.kinds.revenueByTaxRate.title",
    descriptionKey: "reports.kinds.revenueByTaxRate.description",
    icon: "Percent"
  },
  timeByProject: {
    titleKey: "reports.kinds.timeByProject.title",
    descriptionKey: "reports.kinds.timeByProject.description",
    icon: "Clock"
  },
  expensesByCategory: {
    titleKey: "reports.kinds.expensesByCategory.title",
    descriptionKey: "reports.kinds.expensesByCategory.description",
    icon: "Wallet"
  },
  taxSummary: {
    titleKey: "reports.kinds.taxSummary.title",
    descriptionKey: "reports.kinds.taxSummary.description",
    icon: "Landmark"
  }
} as const satisfies Record<ReportKind, ReportPresentation>

export const reportDimensionLabelKeys = {
  revenueByClient: "reports.dimensions.client",
  revenueByProject: "reports.dimensions.project",
  revenueByMonth: "reports.dimensions.month",
  revenueByTaxRate: "reports.dimensions.taxRate",
  timeByProject: "reports.dimensions.project",
  expensesByCategory: "reports.dimensions.category",
  taxSummary: "reports.dimensions.taxRate"
} as const satisfies Record<ReportKind, string>

// The one figure each report is really about, lifted out of its column list so the totals band can
// lead with it. It is not always the first money column: a tax summary's first column is the taxable
// base, but what the reader came for is the net tax still owed.
export const reportHeadlineColumns = {
  revenueByClient: "netRevenue",
  revenueByProject: "netRevenue",
  revenueByMonth: "netRevenue",
  revenueByTaxRate: "netGross",
  timeByProject: "billableValue",
  expensesByCategory: "amount",
  taxSummary: "netTaxDue"
} as const satisfies Record<ReportKind, ReportColumnId>

export const reportFilterLabelKeys = {
  client: { label: "reports.filters.client", all: "reports.filters.allClients" },
  project: { label: "reports.filters.project", all: "reports.filters.allProjects" },
  taxRate: { label: "reports.filters.taxRate", all: "reports.filters.allTaxRates" }
} as const satisfies Record<ReportFilterId, { label: string; all: string }>

export const reportColumnLabelKeys = {
  invoiceCount: "reports.columns.invoiceCount",
  invoiced: "reports.columns.invoiced",
  credited: "reports.columns.credited",
  netRevenue: "reports.columns.netRevenue",
  paid: "reports.columns.paid",
  outstanding: "reports.columns.outstanding",
  netTaxable: "reports.columns.netTaxable",
  netTax: "reports.columns.netTax",
  netGross: "reports.columns.netGross",
  entryCount: "reports.columns.entryCount",
  hours: "reports.columns.hours",
  billableValue: "reports.columns.billableValue",
  expenseCount: "reports.columns.expenseCount",
  amount: "reports.columns.amount",
  rebillableAmount: "reports.columns.rebillableAmount",
  taxableBase: "reports.columns.taxableBase",
  taxAmount: "reports.columns.taxAmount",
  creditedTaxable: "reports.columns.creditedTaxable",
  creditedTax: "reports.columns.creditedTax",
  netTaxDue: "reports.columns.netTaxDue"
} as const satisfies Record<ReportColumnId, string>
