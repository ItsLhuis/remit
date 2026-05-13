# ADR-0008: SMTP and Resend as interchangeable adapter implementations

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: What Remit is](../ARCHITECTURE.md#1-what-remit-is) says the user owns the email
transport and that external providers are optional. Email is used for invoices, proposals,
contracts, invitations, account verification, and password reset links when transport is configured.

[Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience) keeps SMTP
and Resend out of first-run setup and moves them to settings, where the user can test email
delivery. The settings schema stores `emailProvider`, SMTP fields, and `resendApiKey`; sensitive
credentials use `encryptedColumn()`.

The current email feature sends transactional email through one feature entrypoint while choosing
SMTP or Resend from instance settings. The app must also continue working when no email provider is
configured, with CLI/admin reset covering password recovery in that case.

## Decision

SMTP and Resend are interchangeable email adapter implementations behind a common transactional
email interface. The active adapter is selected from instance settings and remains optional.

## Consequences

### Positive

- Self-hosters can use their own SMTP server without depending on a SaaS provider.
- Users who prefer a managed sender can configure Resend without changing application code.

### Negative

- Provider-specific features are limited by the common interface.
- Email configuration, testing, and error handling must account for two different delivery models.

## Alternatives considered

### SMTP only

SMTP is the lowest common denominator for self-hosting. It was rejected as the only option because
deliverability and TLS/auth quirks make managed API senders attractive for many users.

### Resend only

A single API provider would simplify implementation. It was rejected because it would make a third
party mandatory for email and conflict with Remit's self-hosted privacy model.
