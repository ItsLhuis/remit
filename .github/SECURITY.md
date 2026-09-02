# Security policy

Remit holds a freelancer's client records, contracts, bank details and third-party credentials, and
every instance is operated by someone who is not a security team. Vulnerability reports are welcome
and are treated as a priority.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting on this repository: **Security → Report a
vulnerability**. That opens a private advisory visible only to the maintainer, where a fix can be
prepared and disclosed together.

Please include, as far as you can:

- What an attacker can do, and what access they need to start.
- Reproduction steps or a proof of concept.
- The Remit version, from `/settings/system` or the running image tag.
- Whether the instance is self-hosted or Hosted.

Remit is maintained by one person. Expect an acknowledgement within a few days rather than within
hours. If a report goes unanswered for two weeks, please reply on the same advisory thread to bring
it back up.

## Scope

In scope: anything in this repository, the published Docker image, and the documented deployment
assets under `docker-compose.yml` and `scripts/`.

Out of scope: findings that require an attacker to already hold the instance's
`REMIT_ENCRYPTION_KEY` or database credentials; missing hardening on a deployment the operator
configured themselves, such as an instance published without TLS; and automated scanner output with
no demonstrated impact.

## What Remit already does

These are documented in [`docs/architecture/ARCHITECTURE.md`](../docs/architecture/ARCHITECTURE.md)
under Security architecture, and are context for a report rather than a claim that the surface is
closed:

- Mandatory TOTP for every role, with no opt-out.
- AES-256-GCM encryption at rest for third-party credentials and client notes, with a rotation
  command.
- An append-only audit log, enforced by database triggers rather than by convention.
- Public document tokens with 256-bit entropy, constant-time comparison and timing-safe misses.
- Rate limiting on authentication and public token endpoints.
- Strict security headers on every response.

## Disclosure

Fixes are released before details are published. Credit is given in the advisory unless you ask
otherwise.
