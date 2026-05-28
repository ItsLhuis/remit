# ADR-0012: Password reset via email when available, CLI fallback otherwise

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: Security architecture, Password reset paths](../ARCHITECTURE.md#password-reset-paths)
defines two password reset paths. If SMTP or Resend is configured, Better Auth owns the reset token
flow and Remit delivers the email. If email transport is unavailable, a self-hosted operator can run
`pnpm remit:reset-password` through the application container.

[Operational CLI contract: Operator command reference](../operations/CLI-CONTRACT.md#operator-command-reference)
lists the reset command as an operational recovery script for the "lost-everything" case. Password
recovery is deliberately separate from Better Auth backup codes: backup codes are part of the TOTP
plugin and are used only as second-factor fallback during login.

This distinction matters because many self-hosted installations will not configure email on day one,
but password recovery must still exist without inventing a second credential recovery system.

## Decision

Password reset uses Better Auth email reset links when email is configured and a CLI/admin reset
path otherwise. Better Auth backup codes remain only a TOTP fallback and are not used for password
recovery.

## Consequences

### Positive

- Instances without email transport still have a documented recovery path.
- Password recovery and second-factor recovery stay separate, reducing security ambiguity.

### Negative

- CLI/admin reset requires server or container access and is not self-service for ordinary users.
- Users may still misunderstand backup codes unless the UI and docs explain their limited purpose
  clearly.

## Alternatives considered

### Recovery codes for password reset

Custom recovery codes could provide self-service recovery without email. They were rejected because
Better Auth already owns backup codes for TOTP, and overloading that concept would weaken the mental
model.

### Require email for all password resets

This would make recovery simpler for users. It was rejected because Remit must remain usable in
self-hosted environments where SMTP or Resend is intentionally not configured.
