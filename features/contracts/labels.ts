import { type ContractDisplayStatus } from "./types"

type StatusPresentation = {
  variant: "secondary" | "info" | "success" | "warning" | "error"
  icon: "FileText" | "Send" | "FileSignature" | "CalendarX" | "Ban"
}

// Keyed by display status, not stored status, so the derived `expired` reading has a badge of its
// own (services/contractExpiry.ts).
export const contractStatusPresentation: Record<ContractDisplayStatus, StatusPresentation> = {
  draft: { variant: "secondary", icon: "FileText" },
  sent: { variant: "info", icon: "Send" },
  signed: { variant: "success", icon: "FileSignature" },
  expired: { variant: "warning", icon: "CalendarX" },
  terminated: { variant: "error", icon: "Ban" }
}
