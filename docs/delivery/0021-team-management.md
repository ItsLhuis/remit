# DR-0021: Team management and roles

- **Status:** Shipped
- **Date:** 2026-08-12
- **Verdict:** Complete
- **Decisions:** ADR-0013
- **Supersedes:** —
- **Reconstructed:** yes

## What

Three roles — owner, accountant and assistant — with email invitations, membership management and
role enforcement across the write paths.

## Why

A freelancer is one person until their accountant needs the numbers or an assistant drafts the
invoices. Sharing the owner's password is what happens without this, which puts the Stripe key and
the client notes in the same hands as the bookkeeping. The constraint is that adding roles must not
turn a single-instance product into a multi-tenant one.

## Scope

Included: the three roles, invitation by email with acceptance, membership listing and removal, role
changes, and the `requireRole` gate applied to the write paths and route segments that need it.
Accountants are read-only with export; assistants create drafts but cannot send or delete.

Excluded: custom roles and per-resource permissions. Three fixed roles cover the real cases and a
permission matrix would have been a product of its own. Also excluded: Remit storing membership
itself — organizations, members, invitations and roles are Better Auth's per ADR-0013, and there is
one organization per instance.

## How

`requireRole` reads the active member role from Better Auth and deliberately does not create or
repair a missing membership. A helper that heals its own preconditions cannot fail closed, and
failing closed is the only useful behaviour for an authorization gate.

Invitations are allowed without email verification of the invitee, because the invitation itself is
the proof of address — the link only reaches whoever controls the mailbox it was sent to.

The role is recorded on each audit entry as `actor_role`, so an action can be attributed to the
capacity it was taken in rather than only to the person.

## Evidence

- `features/team/` — `mutations.ts`, `queries.ts`, `invitationEmail.ts`,
  `services/teamMembership.ts`
- `lib/auth/session.ts` — `requireSession` and `requireRole`
- `lib/auth/index.ts` — the organization plugin configuration and invitation settings
- `database/schema/organizations.ts`, `database/schema/auditLogs.ts` — `actor_role`
- `app/(dashboard)/settings/team/`, `app/(auth)/invite/[invitationId]/`
- `docs/architecture/adr/0013-better-auth-organization.md`, `docs/architecture/ARCHITECTURE.md` —
  Multi-user model

## Verification

`features/team/__tests__/mutations.integration.test.ts` and `queries.integration.test.ts` cover
invitation, acceptance, listing, role change and removal against a real Postgres. Service tests
cover the membership resolution. The owner-only route guards are covered by the settings integration
tests that assert a non-owner is refused.

Not covered by an end-to-end test: the invitation journey from email link to accepted membership in
a browser.

## Known gaps

Nothing recorded on the day.
