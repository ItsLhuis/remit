# ADR-0003: Mandatory TOTP — no opt-out

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Remit stores invoices, client records, payment settings, SMTP credentials, API keys, and potentially
confidential notes.
[Architecture: Security architecture](../ARCHITECTURE.md#9-security-architecture) treats security as
a product feature, not an optional enterprise add-on, and its authentication flow includes TOTP
verification after credential verification.

The setup wizard in
[Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience) keeps
first-run configuration short but still makes TOTP enrollment mandatory. Backup codes are generated
by Better Auth as part of the TOTP flow and are used only when the authenticator app is unavailable.

Self-hosted deployments vary widely in operator skill and perimeter security. Some will sit behind a
well-managed reverse proxy; others may be exposed directly to the public internet. The application
cannot assume a strong external security boundary.

## Decision

TOTP enrollment is mandatory for every user during setup and login. Remit will not provide a UI or
configuration switch to disable TOTP.

## Consequences

### Positive

- Password compromise alone is not enough to access a Remit instance.
- The support and test matrix is smaller because every authenticated user follows the same auth
  flow.

### Negative

- First-run setup has more friction than email-and-password-only products.
- Lost authenticator access requires backup codes or an operational recovery path, which raises the
  importance of user education.

## Alternatives considered

### Optional TOTP

Optional TOTP would reduce onboarding friction. It was rejected because the users most at risk are
also the least likely to enable extra security voluntarily.

### Owner-only TOTP

Requiring TOTP only for the owner would reduce burden for accountant or assistant users. It was
rejected because those roles can still view or alter sensitive business records within their
permissions.
