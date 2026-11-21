import { type InvoiceViewStatus } from "./schemas"

type StatusPresentation = {
  variant: "secondary" | "info" | "success" | "warning" | "error"
  icon: "FileText" | "Send" | "CircleCheck" | "TriangleAlert" | "CircleDashed"
}

export const invoiceStatusPresentation: Record<InvoiceViewStatus, StatusPresentation> = {
  draft: { variant: "secondary", icon: "FileText" },
  sent: { variant: "info", icon: "Send" },
  paid: { variant: "success", icon: "CircleCheck" },
  overdue: { variant: "error", icon: "TriangleAlert" },
  partially_paid: { variant: "warning", icon: "CircleDashed" }
}
