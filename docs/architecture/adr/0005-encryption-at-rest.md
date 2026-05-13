# ADR-0005: AES-256-GCM encryption via Drizzle column helper

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: Data layer, The `encryptedColumn()` helper](../ARCHITECTURE.md#the-encryptedcolumn-helper)
requires encrypted fields to use `encryptedColumn()`, and
[Architecture: Security architecture, Encryption at rest](../ARCHITECTURE.md#encryption-at-rest)
lists the current sensitive fields: SMTP password, Resend API key, Stripe secrets, payment IBAN, and
client notes. The encryption foundation lives in `database/schema/helpers.ts` and
`lib/encryption/aes.ts`.

The application is self-hosted, so the PostgreSQL database may live on a VPS, local NAS, or managed
database chosen by the operator. The architecture cannot assume disk encryption or managed secret
handling outside the application.

The master key comes from `REMIT_ENCRYPTION_KEY`, generated at install time.
[Architecture: Data layer, The `encryptedColumn()` helper](../ARCHITECTURE.md#the-encryptedcolumn-helper)
is explicit that losing this key permanently loses encrypted fields; that is an operational cost of
self-hosted encryption.

## Decision

Sensitive database columns are encrypted at rest with AES-256-GCM through the Drizzle
`encryptedColumn()` helper. Application code reads and writes plaintext values while PostgreSQL
stores authenticated ciphertext.

## Consequences

### Positive

- Sensitive credentials are not stored as plaintext in database backups or dumps.
- A single schema helper makes encryption consistent across existing and future sensitive fields.

### Negative

- Losing `REMIT_ENCRYPTION_KEY` makes encrypted values unrecoverable.
- Encrypted columns cannot be meaningfully searched, indexed, or partially updated without new
  design work.

## Alternatives considered

### Encrypt in each service

Individual services could call encryption functions before writes and after reads. It was rejected
because omissions would be hard to catch and schema definitions would no longer reveal which fields
are sensitive.

### Database-managed encryption

PostgreSQL extensions or disk-level encryption could protect stored data. They were rejected as the
primary mechanism because Remit cannot require self-hosters to operate a specific database extension
or infrastructure layer.
