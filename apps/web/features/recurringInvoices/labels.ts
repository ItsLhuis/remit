import { type RecurringInvoiceStatus } from "./schemas"

type StatusPresentation = {
  variant: "secondary" | "info" | "success" | "warning" | "error"
  icon: "Play" | "Pause" | "CircleCheck" | "CircleSlash"
}

// `completed` is a success and `cancelled` is not a failure — one schedule finished its run, the
// other was called off. Neither is an error state, so neither gets the error variant that would put
// them beside an overdue invoice in the eye's scanning order.
export const recurringInvoiceStatusPresentation: Record<
  RecurringInvoiceStatus,
  StatusPresentation
> = {
  active: { variant: "success", icon: "Play" },
  paused: { variant: "warning", icon: "Pause" },
  completed: { variant: "info", icon: "CircleCheck" },
  cancelled: { variant: "secondary", icon: "CircleSlash" }
}
