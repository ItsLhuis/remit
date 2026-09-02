# DR-0028: Encryption key rotation

- **Status:** Shipped
- **Date:** 2026-05-28
- **Verdict:** Complete
- **Decisions:** ADR-0021
- **Supersedes:** —
- **Reconstructed:** yes

## What

`pnpm remit:rotate-encryption-key`, which rewrites every Remit-owned encrypted column and every
`.remitbak` archive envelope from an explicit old key to an explicit new key, resumably and under an
advisory lock.

## Why

One key protects the SMTP password, the Stripe secret, the bank IBAN, the client notes and every
backup archive. A key that can never be changed is a key that stays compromised after it leaks, and
one rotated by hand across encrypted columns and archives is one that gets rotated halfway.

## Scope

Included: a two-key window with both keys supplied explicitly; a mandatory pre-rotation backup;
refusal rules before any write; table-scoped rotation with per-table commits and audit markers;
`--resume` after a partial failure; re-encryption of local and remote archive envelopes; and audit
entries for started, per-table completion, backup re-encryption, completed and aborted.

Excluded: Better Auth-owned secrets — password hashes, TOTP secrets, backup codes, sessions,
verification tokens, organizations and memberships. They are outside the `encryptedColumn()`
registry and are not Remit's to rewrite. Also excluded: rewriting `.env` or deployment
configuration, so swapping the key the container starts with remains the operator's step.

## How

Keys are never accepted through argv, because command-line arguments land in shell history and in
the process table. Interactive runs use masked prompts; unattended runs require
`REMIT_ALLOW_UNATTENDED_KEY_ROTATION=1` plus `REMIT_OLD_KEY` and `REMIT_NEW_KEY`.

The column set is the live registry from `encryptedColumn()` rather than a maintained list, so a
newly declared encrypted column is rotated without anyone remembering to register it and no drift
guard is needed — the registry is the schema.

The advisory lock is taken on a **reserved** connection and that same connection is handed back to
the caller, because an advisory lock lives on the session that took it. Through the pool, the
connection could be returned between statements, a second rotation could acquire the lock
mid-rewrite, and the unlock could run on whichever session happened to be free.

Rotation is table-scoped and each table commits independently, with its completion marker written
inside the same transaction as its updates. That is what makes `--resume` correct: a failure leaves
earlier tables on the new key and later ones on the old, and the marker is the only trustworthy
record of which is which precisely because it cannot commit separately from the data it describes.

Errors and audit metadata are redacted, so a failure cannot print key material.

## Evidence

- `scripts/rotate-encryption-key.ts`, `scripts/core/keyRotation/` — `runRotation.ts`, `columns.ts`,
  `rotateTables.ts`, `archives.ts`, `lock.ts`, `progress.ts`, `readKeys.ts`, `verifyOldKey.ts`,
  `audit.ts`, `redact.ts`, `errors.ts`, `settings.ts`, `args.ts`
- `database/schema/helpers.ts` — `encryptedColumn()` and `getEncryptedColumns()`
- `scripts/core/archive/reencrypt.ts`
- `docs/architecture/adr/0021-encryption-key-rotation.md`
- `docs/architecture/operations/CLI-CONTRACT.md` — the `pnpm remit:rotate-encryption-key` section

## Verification

`scripts/core/keyRotation/__tests__/rotateEncryptionKey.integration.test.ts` rotates every
registered column against the Dockerized test Postgres and asserts each value decrypts under the new
key. `keyRotation.test.ts` covers the refusal rules — equal keys, a key that does not decode to 32
bytes, and a lock that cannot be acquired — and the resume path skipping tables with completion
markers. `scripts/core/archive/__tests__/backupArchive.test.ts` covers envelope re-encryption.

Not covered by an automated test: a rotation interrupted by a real process kill mid-table. Resume is
verified by simulating the failure between table commits rather than by killing the process.

## Known gaps

The command does not rewrite `.env` or deployment configuration, so an operator who rotates and does
not update the running key will fail to decrypt on next boot. The runbook step is the mitigation.
