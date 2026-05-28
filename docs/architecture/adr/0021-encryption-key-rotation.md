# ADR-0021: Encryption key rotation

- **Status:** Accepted
- **Date:** 2026-05-26

## Context

ADR-0005 defines `REMIT_ENCRYPTION_KEY` as the AES-256-GCM master key for fields declared through
`encryptedColumn()`. ADR-0020 extends that same key to encrypted `.remitbak` backup archives. Losing
the key loses encrypted database fields and encrypted backups, so rotation must be deliberate,
recoverable, and auditable.

[Architecture: Encryption key rotation](../ARCHITECTURE.md#encryption-key-rotation) reserved
`remit:rotate-encryption-key` but explicitly deferred implementation until this dedicated ADR pinned
the two-key window, encrypted-column coverage, backup handling, audit behavior, and refusal rules.

Better Auth owns its own credential storage, including password hashes, TOTP secrets, backup codes,
sessions, verification tokens, organizations, and memberships. Those values are outside Remit's
`encryptedColumn()` registry and are not rotated by this command.

## Decision

Remit ships `remit:rotate-encryption-key` as an in-container operational command. The command
rotates Remit-owned encrypted database columns and backup archive encryption from an explicit old
key to an explicit new key.

The durable rotation rules are:

- The command uses a two-key window. Operators provide the old key, which must match the current
  `REMIT_ENCRYPTION_KEY`, and the new key explicitly through masked prompts or through
  `REMIT_OLD_KEY` / `REMIT_NEW_KEY` only when `REMIT_ALLOW_UNATTENDED_KEY_ROTATION=1` is set. Keys
  are never accepted as command-line arguments.
- A pre-rotation backup is mandatory. The operator may pass `--backup-file <path>` for an existing
  verified `.remitbak`, or the command invokes `remit:backup` and aborts if that backup fails.
- The command refuses to start when old and new keys are equal, either key fails to decode to
  exactly 32 bytes of base64, or `pg_try_advisory_lock(0x52454d4954524f54)` cannot acquire the
  rotation lock.
- The encrypted column registry is auto-derived at module load. `encryptedColumn()` in
  `database/schema/helpers.ts` intercepts column construction and registers every
  `{ table, column }` pair as `pgTable(...)` builds it. Callers read the live registry via
  `getEncryptedColumns()`. No manual registry file or drift-guard test is required: the registry is
  the schema.
- Rotation is table-scoped. Each table is re-encrypted inside its own transaction and committed
  independently. The table completion audit marker is written inside the same transaction as the
  table updates.
- A failure after one or more table commits leaves earlier tables on the new key and later tables on
  the old key. Recovery uses `--resume`, reads `instance.key_rotation.table_completed` markers,
  skips completed tables, and continues the same operation.
- After all registered columns rotate, the command lists `.remitbak` archives at configured backup
  destinations and re-encrypts each archive envelope with the new key. Local archives are written to
  a temporary path and atomically renamed. Remote S3-compatible objects are overwritten at the same
  key. Archive re-encryption failures are logged but do not roll back the committed database
  rotation.
- The command writes `audit_logs` entries with event types `instance.key_rotation.started`,
  `instance.key_rotation.table_completed`, `instance.key_rotation.backup_reencrypted`,
  `instance.key_rotation.completed`, and `instance.key_rotation.aborted`. Audit metadata never
  contains key material, plaintext encrypted values, database credentials, or secret fingerprints in
  cleartext.
- The command never rewrites `.env` or deployment configuration. After a successful rotation it
  prints operator instructions to set `REMIT_ENCRYPTION_KEY` to the new key and restart the stack.

The documented flow is:

1. Acquire the advisory lock and verify the provided old and new keys.
2. Verify the old key matches the running container's `REMIT_ENCRYPTION_KEY` and can decrypt an
   existing encrypted database value when one exists.
3. Release the advisory lock before the potentially long pre-rotation backup.
4. Verify the provided backup file or create a local pre-rotation backup.
5. Reacquire the advisory lock and write `instance.key_rotation.started`.
6. For each registered encrypted table, decrypt old values, encrypt with the new key, update by
   primary key, and write `instance.key_rotation.table_completed` in the same transaction.
7. Re-encrypt configured `.remitbak` archives with the new archive key.
8. Write `instance.key_rotation.completed` or `instance.key_rotation.aborted`.
9. Print instructions for the operator to update `REMIT_ENCRYPTION_KEY` and restart the stack.

## Consequences

### Positive

- Key rotation is recoverable after a mid-run failure because table progress is committed and
  audited per table.
- The advisory lock prevents two rotations from mutating the same encrypted values concurrently.
- New encrypted columns cannot silently miss the rotation path because the registry test fails.
- Operators cannot accidentally leak keys through shell history or process lists.
- The command does not mutate deployment-owned `.env` files.

### Negative

- During a failed rotation, the database can temporarily contain a mix of old-key and new-key
  encrypted tables. Operators must rerun with `--resume`; normal application use should remain
  stopped until completion.
- Backup archive re-encryption is best-effort after the database rotation has committed. A database
  rotation is not rolled back because a remote archive failed to overwrite.
- The command is IO-heavy and intentionally conservative. Large databases and many remote archives
  can take significant time.

## Alternatives considered

### Multi-key concurrent decryption in the application

Application runtime could accept both old and new keys during a migration window and lazily rewrite
values on read. It was rejected for the initial implementation because it expands the boot-time
secret surface and makes normal request paths responsible for operational recovery.

### Store keys in `.env` automatically

The command could rewrite `.env` after success. It was rejected because deployment configuration is
operator-owned and may live in Docker Compose, a secrets manager, a platform UI, or Hosted-managed
infrastructure. The command prints exact post-run steps instead.

### Rotate Better Auth secrets

Better Auth-owned password hashes, TOTP secrets, backup codes, sessions, verification tokens, and
organization state are not Remit `encryptedColumn()` values. Rotating them here would violate the
auth ownership boundary and is rejected.

### Roll back all database changes if one backup archive fails

Rolling back table commits after backup archive failures would require a second destructive
database-wide rewrite and would make the recovery story worse. Database rotation commits first;
archive re-encryption failures are visible for operator rerun.
