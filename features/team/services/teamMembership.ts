import { ASSIGNABLE_ROLES, type AssignableRole } from "../schemas"

export type TeamRole = "owner" | AssignableRole

export type TeamMembershipDecision =
  | { allowed: true }
  | { allowed: false; reason: "ownerImmutable" | "selfRemoval" | "roleUnchanged" }

export function toTeamRole(value: string): TeamRole | null {
  if (value === "owner") return "owner"

  return toAssignableRole(value)
}

export function toAssignableRole(value: string): AssignableRole | null {
  return ASSIGNABLE_ROLES.find((role) => role === value) ?? null
}

// The two directions the owner invariant can be broken from this feature, refused before any write
// reaches Better Auth. Demoting the owner would leave the instance with none; promoting anyone to
// owner is unreachable because `AssignableRole` excludes it, so `nextRole` alone cannot express the
// second-owner case and only the target's current role has to be checked here.
export function decideRoleChange(
  currentRole: TeamRole,
  nextRole: AssignableRole
): TeamMembershipDecision {
  if (currentRole === "owner") return { allowed: false, reason: "ownerImmutable" }

  if (currentRole === nextRole) return { allowed: false, reason: "roleUnchanged" }

  return { allowed: true }
}

export function decideRemoval(targetRole: TeamRole, isSelf: boolean): TeamMembershipDecision {
  if (targetRole === "owner") return { allowed: false, reason: "ownerImmutable" }

  if (isSelf) return { allowed: false, reason: "selfRemoval" }

  return { allowed: true }
}

export type PendingInvitationInput = {
  status: string
  expiresAt: Date
}

export function isInvitationPending(
  { status, expiresAt }: PendingInvitationInput,
  now: Date
): boolean {
  return status === "pending" && expiresAt.getTime() > now.getTime()
}

export function buildInvitationLink(baseUrl: string, invitationId: string): string {
  return new URL(`/invite/${invitationId}`, baseUrl).toString()
}

const roleOrder: Record<TeamRole, number> = {
  owner: 0,
  accountant: 1,
  assistant: 2
}

export type SortableTeamMember = {
  role: TeamRole
  name: string
}

export function sortTeamMembers<T extends SortableTeamMember>(members: T[]): T[] {
  return members.toSorted((first, second) => {
    if (first.role !== second.role) return roleOrder[first.role] - roleOrder[second.role]

    return first.name.localeCompare(second.name)
  })
}
