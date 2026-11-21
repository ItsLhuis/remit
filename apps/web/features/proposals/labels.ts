import { type ProposalStatus } from "./schemas"

type StatusPresentation = {
  variant: "secondary" | "info" | "success" | "error"
  icon: "FileText" | "Send" | "CircleCheck" | "CircleX"
}

export const proposalStatusPresentation: Record<ProposalStatus, StatusPresentation> = {
  draft: { variant: "secondary", icon: "FileText" },
  sent: { variant: "info", icon: "Send" },
  accepted: { variant: "success", icon: "CircleCheck" },
  rejected: { variant: "error", icon: "CircleX" }
}
