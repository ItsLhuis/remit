# ADR-0020: Operational CLI contract

- **Status:** Accepted
- **Date:** 2026-05-17
- **Documentation layout updated:** 2026-05-25

## Context

Remit ships operational behaviour - credential reset, backup, restore, encryption key rotation, demo
seed, and host-side upgrade - as commands an operator runs against a real installation. Without a
single contract governing how those commands are named, where they execute, when they are allowed to
become `package.json` scripts, and what irrevocable formats they commit to, planned work risks four
recurring failure modes:

1. **Placeholder scripts.** A `package.json` key that resolves to a stub or missing file advertises
   a capability the product does not have.
2. **Mixed execution contexts.** A command that needs Docker socket access or host-image pulls
   cannot honestly live as an in-container `pnpm` script; mounting the Docker socket into the app
   container would be a substantial privilege escalation that contradicts the security posture in
   [`.agents/rules/security.md`](../../../.agents/rules/security.md).
3. **Inconsistent archive formats.** Backup archives are long-lived artefacts: restore code in
   version N must read archives written by version N. The byte layout, encryption algorithm, and
   manifest shape must be settled before implementation, then versioned.
4. **ADR sprawl.** Recording every operational command as its own ADR duplicates the shared rules
   across many files and obscures which decisions are durable.

This ADR originally kept the implementation-facing operational detail inline in
[Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience) and rejected
a standalone CLI contract document. Implementation pressure showed that `ARCHITECTURE.md` was
carrying too much command, archive, restore, and runbook detail for a high-level architecture
document.

Although accepted ADRs are normally immutable, this update intentionally reverses that
documentation-organization choice. The technical decisions remain accepted and unchanged.

## Decision

Operational behaviour ships under a single contract with execution context, promotion, packaging,
validation, archive, restore, and upgrade rules. The accepted operational model is unchanged:

- In-container operational commands use `remit:<operation>` package scripts only when they are fully
  implemented.
- Placeholder package scripts are rejected.
- Every operational command declares an execution context.
- The app container must never mount the Docker socket.
- Host-side scripts live under `scripts/host/` and are not copied into the runtime image.
- Upgrade is host-side only.
- There is no `remit:upgrade` package script.
- `remit:upgrade` is not a reserved package script name.
- `docker-entrypoint.sh` remains the migration path on container start.
- Backup format remains `.remitbak` with the documented encrypted archive contract.
- Restore remains destructive-safe with a mandatory pre-restore snapshot and refusal rules.
- Encryption key rotation remains deferred until a dedicated ADR defines the rotation semantics.

The documentation layout is now:

- [Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience) remains the
  architectural overview. It explains the self-hosting model, durable boundaries, current
  implementation status, and links to deeper references.
- [Operational CLI contract](../operations/CLI-CONTRACT.md) owns naming, execution context,
  promotion criteria, build and packaging, validation baseline, status matrix, and the explicit
  `remit:upgrade` exception.
- [Backup archive format](../specs/BACKUP-ARCHIVE.md) owns the `.remitbak` filename convention, byte
  layout, decrypted payload layout, manifest shape, encryption contract, destinations, forward
  compatibility, and backup audit behaviour.
- [Restore runbook](../../operations/RESTORE.md) owns destructive restore warnings, pre-restore
  snapshot requirements, confirmation requirements, refusal rules, database/upload effects,
  logging/redaction, and operator-facing restore notes.
- [Upgrade runbook](../../operations/UPGRADE.md) owns host-side upgrade prerequisites, execution,
  rollback, troubleshooting, and safety boundaries.

Later changes to the byte layout, encryption algorithm, restore refusal rules, or upgrade execution
model must be recorded in a new ADR that supersedes this one for that point.

## Consequences

### Positive

- `ARCHITECTURE.md` stays readable as the high-level architecture source of truth while still
  deciding and linking to the operational contracts.
- Operators get focused runbooks for upgrade and restore instead of mining an architecture overview
  for procedures.
- Contributors get focused implementation contracts for CLI commands and backup archives.
- Placeholder scripts remain categorically rejected by the promotion criteria.
- The privacy- and security-first posture is preserved: the app container is never granted Docker
  daemon access, and upgrade is honestly host-side.
- Backup archives retain a precise, versioned byte layout that restore can fixture-test
  deterministically.
- Restore remains destructive but never silent: the mandatory pre-restore snapshot, typed
  confirmation, and refusal rules make accidental data loss require deliberate operator action.

### Negative

- The self-hosting source of truth is now distributed across linked documents. The architecture
  overview must keep those links current.
- A reader looking for every detail from the old inline section now has to follow the appropriate
  reference link.
- Reusing `REMIT_ENCRYPTION_KEY` means losing that key loses both encrypted columns and encrypted
  backups. Operator-facing docs must continue to emphasize key safekeeping.
- A single-destination-per-backup-run policy means an operator who wants redundant remote backups
  runs `remit:backup` once per destination. Multi-destination fan-out remains a future revision.
- "One-command upgrade" is a host-side experience rather than `docker exec ... pnpm remit:upgrade`.
  README.md, the architecture overview, and the upgrade runbook must describe this honestly so
  operator expectations match reality.

## Alternatives considered

### One ADR per operational script

The first draft split the macro decision across a contract ADR, a backup-archive-format ADR, and an
upgrade-execution-model ADR. The split was rejected because the rules are shared and the spec is
forward-looking. A single ADR remains the right decision record for the operational model.

### Keep all implementation detail inline in `ARCHITECTURE.md`

This was the original ADR-0020 choice. It kept the planning narrative and operational contract in
one place, but implementation pressure made the architecture document too operational. The choice is
now reversed for maintainability and operator usability. `ARCHITECTURE.md` remains the architectural
overview; focused documents own the CLI contract, backup archive format, restore runbook, and
upgrade runbook.

### Document the contract in `docs/architecture/operations/CLI-CONTRACT.md`

This was originally rejected because it introduced another document to keep in sync with
Architecture. It is now accepted. The architecture overview links to the contract, and the contract
owns the implementation-facing details.

### Allow the app container to mount the Docker socket and orchestrate its own upgrade

This would enable a container-local upgrade command. It was rejected because mounting the Docker
socket gives the application full control over the host's Docker daemon. A single application
vulnerability would become a host compromise. The ergonomic gain does not justify the escalation
surface.

### `pg_dump --format=plain` for the database payload

A plain SQL dump is human-readable. It was rejected because the custom format compresses better,
restores faster, and supports `pg_restore --clean --if-exists` cleanly without role assumptions on
the target instance. Human inspection of an encrypted production backup is rare and not the right
design constraint.

### Separate dedicated backup encryption key, such as `REMIT_BACKUP_KEY`

A backup-only key would decouple backup rotation from column-encryption rotation. It was rejected
for the initial release because it doubles the secret-management surface without solving a concrete
problem we have today. The future key-rotation ADR can introduce a separate key if rotation
semantics demand it.

### Multi-file archive

Storing a manifest, dump, and uploads tree as adjacent files would simplify partial restores. It was
rejected because the operator workflow is clearer with a single archive artefact, and partial
restore is not a goal at this stage.

### `age` or external encryption tooling

`age` would offload format and key-management complexity to a battle-tested library. It was rejected
because Remit already uses Node's built-in AES-256-GCM for column encryption and a backup should
reuse the same key. Adding `age` would add a third-party dependency and a parallel key ecosystem.
