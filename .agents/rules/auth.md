# Auth Rules

Better Auth owns authentication state: users, accounts, sessions, password hashing and password
changes, password reset tokens, email verification and change-email verification, TOTP secrets,
backup codes, organizations, memberships, active organization state, invitations, and roles.

Runtime application code uses Better Auth APIs, client methods, and helpers for Better Auth-owned
state. It must not directly insert, update, or delete Better Auth tables such as `users`,
`accounts`, `sessions`, `organizations`, `members`, `invitations`, `two_factors`, and
`verifications`.

Direct database access to Better Auth-owned tables is acceptable only for:

- Read-only bootstrap checks when no Better Auth API exists.
- Schema definitions and generated migrations.
- Explicit operational recovery scripts, such as the password reset CLI.

`requireSession` and `requireRole` in `lib/auth/session.ts` are the canonical application
authorization helpers. `requireRole` delegates to Better Auth organization state, specifically the
active member role, and must not create or repair memberships as a fallback.

Organization creation, active organization selection, membership changes, invitations, and role
changes use Better Auth organization APIs. Remit uses one Better Auth organization per instance.

Password reset and password changes use Better Auth email/password APIs. Remit must not create its
own runtime password reset tokens or write credential password hashes directly outside documented
operational recovery scripts.

TOTP setup, verification, recovery-code consumption, and recovery-code regeneration use Better Auth
two-factor APIs. The one exception is `lib/auth/totpReconfigure.ts`, the one runtime writer: inside
Better Auth's pipeline and through its adapters it writes only `two_factors.secret` and its own
`totp-reconfigure-<userId>` entry in `verifications`, and it verifies a code only against that
pending secret.

Auth-sensitive routes and actions that write audit metadata use shared request metadata helpers,
including `getIpAddress` from `@/lib/utils`, instead of parsing forwarded headers inline.

Never log passwords, reset tokens, verification tokens, TOTP secrets, backup codes, session tokens,
API keys, or encryption keys.
