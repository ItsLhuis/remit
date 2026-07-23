import { type LeadStatus } from "./schemas"

type StatusPresentation = {
  variant: "secondary" | "info" | "warning" | "default" | "success" | "error"
  icon: "Sparkles" | "Phone" | "CircleDot" | "Send" | "Trophy" | "CircleX"
}

export const leadStatusPresentation: Record<LeadStatus, StatusPresentation> = {
  new: { variant: "secondary", icon: "Sparkles" },
  contacted: { variant: "info", icon: "Phone" },
  qualified: { variant: "warning", icon: "CircleDot" },
  proposal_sent: { variant: "default", icon: "Send" },
  won: { variant: "success", icon: "Trophy" },
  lost: { variant: "error", icon: "CircleX" }
}
