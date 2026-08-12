import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

// The owner is structural, not a seat: `uq_member_owner_per_org` is a partial unique index that
// makes a second owner unstorable, and Better Auth refuses to leave the organization without one.
// Neither guard covers the remaining direction — an owner promoting somebody else to owner — so
// this tuple is what refuses it, and every invite and role change parses through it first.
export const ASSIGNABLE_ROLES = ["accountant", "assistant"] as const

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export const inviteTeamMemberSchema = z.object({
  email: z
    .email(i18n.t("settings.team.validation.emailInvalid"))
    .transform((email) => email.trim().toLowerCase()),
  role: z.enum(ASSIGNABLE_ROLES, i18n.t("settings.team.validation.roleInvalid"))
})

// Only the input side is exported: the dialog resolves with `raw: true` so the controls hold the
// untrimmed string the user typed, and the transformed output only ever exists inside the action
// that re-parses it.
export type InviteTeamMemberInputValues = z.input<typeof inviteTeamMemberSchema>

export const changeTeamMemberRoleSchema = z.object({
  memberId: z.uuid(i18n.t("settings.team.validation.memberIdInvalid")),
  role: z.enum(ASSIGNABLE_ROLES, i18n.t("settings.team.validation.roleInvalid"))
})

export const removeTeamMemberSchema = z.object({
  memberId: z.uuid(i18n.t("settings.team.validation.memberIdInvalid"))
})

export const teamInvitationIdSchema = z.object({
  invitationId: z.uuid(i18n.t("settings.team.validation.invitationIdInvalid"))
})
