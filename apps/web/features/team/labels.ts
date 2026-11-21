import { type TeamRole } from "./services/teamMembership"

type RolePresentation = {
  variant: "default" | "info" | "secondary"
  icon: "Crown" | "Calculator" | "UserRound"
}

export const teamRolePresentation: Record<TeamRole, RolePresentation> = {
  owner: { variant: "default", icon: "Crown" },
  accountant: { variant: "info", icon: "Calculator" },
  assistant: { variant: "secondary", icon: "UserRound" }
}
