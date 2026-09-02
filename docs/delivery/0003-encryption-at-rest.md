# DR-0003: Encryption at rest

- **Status:** Shipped
- **Date:** 2026-05-28
- **Verdict:** Complete
- **Decisions:** ADR-0005
- **Supersedes:** —
- **Reconstructed:** yes

## What

AES-256-GCM encryption of the columns holding third-party credentials and client notes, applied
through a Drizzle custom column type rather than at each call site.

## Why

A self-hosted instance stores an SMTP password, a Resend key, a Stripe secret key and webhook
secret, a bank IBAN and the freelancer's private notes about their clients. A database dump, a
backup file or a stolen disk should not hand all of that over in plaintext. Encrypting at the call
site would have worked exactly as long as every future write remembered to.

## Scope

Included: the AES-256-GCM helper, the `encryptedColumn()` Drizzle column type that encrypts on write
and decrypts on read, the columns designated encrypted in the architecture's security section, and
the registry that lets an operational script enumerate every encrypted column without being told
about new ones.

Excluded: Better Auth-owned secrets — password hashes, TOTP secrets, backup codes, session and
verification tokens. Those are Better Auth's storage per ADR-0013, and Remit does not re-encrypt
another library's columns underneath it. Also excluded is encryption of uploaded objects at rest,
which is the storage backend's concern.

## How

`encryptedColumn()` registers itself in `encryptedColumnRegistry` at the moment it is declared,
keyed by table and column name. That is the load-bearing part: it makes the registry complete and
self-maintaining, so declaring a new encrypted column is enough for key rotation to find it, and
there is no second list to forget to update. The file-top comment in `database/schema/helpers.ts`
states the invariant.

The key is validated at boot in `lib/config/env.ts` and the process exits when it is missing, rather
than starting and failing on the first read. Its fingerprint — not the key — is surfaced on the
health dashboard so an operator can tell two instances apart.

## Evidence

- `lib/encryption/aes.ts`, `lib/encryption/__tests__/`
- `database/schema/helpers.ts` — `encryptedColumn()` and `encryptedColumnRegistry`
- `database/schema/settings.ts`, `database/schema/clients.ts` — the encrypted columns
- `scripts/core/keyRotation/runRotation.ts` — the registry's consumer
- `docs/architecture/adr/0005-encryption-at-rest.md`
- `docs/architecture/ARCHITECTURE.md` — Security architecture, Encryption at rest

## Verification

Unit tests cover the AES helper's round trip and its rejection of tampered ciphertext. The registry
is verified indirectly by the key rotation integration tests, which rotate every registered column
and assert each value decrypts under the new key.

Not covered by a test: that the set of columns designated encrypted in the architecture matches the
set actually declared with `encryptedColumn()`. That correspondence is maintained by review.

## Known gaps

Nothing recorded on the day. The reasoning for the specific column set was recorded in ADR-0005 and
the architecture's security section rather than in the commits.
