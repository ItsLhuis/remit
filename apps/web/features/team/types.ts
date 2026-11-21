import { type AssignableRole } from "./schemas"
import { type TeamRole } from "./services/teamMembership"

export type TeamMemberListItem = {
  id: string
  userId: string
  name: string
  email: string
  role: TeamRole
  joinedAt: Date
  isCurrentUser: boolean
}

export type TeamInvitationListItem = {
  id: string
  email: string
  role: AssignableRole
  expiresAt: Date
  // Present only when the instance cannot send mail, because that is the single case where the
  // owner has to deliver the invitation by hand. Keeping it off the read model otherwise means a
  // configured instance never renders a live invitation link into a page it does not need it on.
  shareLink: string | null
}

export type TeamPageData = {
  members: TeamMemberListItem[]
  invitations: TeamInvitationListItem[]
  emailConfigured: boolean
  locale: string
  timeZone: string
}

export type InvitationPreview = {
  invitationId: string
  organizationName: string
  email: string
  role: AssignableRole
  // These three are resolved server-side so the acceptance form knows which of its shapes to render
  // without a client round-trip: no session (sign up), the right session (accept), or a session
  // belonging to somebody else (sign out first).
  sessionEmail: string | null
  isAlreadyMember: boolean
  // A removed member keeps their `users` row — Better Auth's `removeMember` deletes the membership
  // only, and `audit_logs.actor_user_id` still points at it. Re-inviting that address therefore
  // reaches somebody who already has credentials, for whom signing up would fail on the unique
  // email. The form offers sign-in instead of registration when this is set.
  hasAccount: boolean
}
