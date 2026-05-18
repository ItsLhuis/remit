# ADR-0020: Operational CLI contract

- **Status:** Accepted
- **Date:** 2026-05-17

## Context

Remit ships operational behaviour — credential reset, backup, restore, encryption key rotation, demo
seed — as commands an operator runs against a real installation. Without a single contract governing
how those commands are named, where they execute, when they are allowed to become `package.json`
scripts, and what irrevocable formats they commit to, planned work risks four recurring failure
modes:

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
   (naming, build, promotion, validation) across many files and obscures which decisions are
   actually durable.

[Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience) is the
authoritative, forward-looking specification of the entire self-hosting surface — install, setup,
health, backup, restore, upgrade, key rotation, deployment guides. This ADR records the one-time
macro decision that anchors that section; the implementation-facing detail lives in the section
itself.

## Decision

Operational behaviour ships as `remit:<operation>` CLI commands governed by a single contract
documented inline in
[Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience). The contract
pins, durably:

- **Naming and shape.** Every command uses the key `remit:<operation>` in `package.json`, the source
  path `scripts/<operation>.ts`, the compiled output `scripts/dist/<operation>.js`, and the
  invocation `node ./scripts/dist/<operation>.js`. Reserved names cannot be reused.
- **Execution context.** Every command declares exactly one of `in-container` or `host-side`.
  Destructive commands may not declare "both". Host-side commands live under `scripts/host/` as
  POSIX shell scripts and are never copied into the runtime image. Mounting the Docker socket into
  the app container is rejected categorically.
- **Promotion criteria.** A command becomes a `package.json` script only when it has a real
  end-to-end implementation, tier-appropriate test coverage per
  [`.agents/rules/testing.md`](../../../.agents/rules/testing.md), docs-accuracy in the same PR that
  moves it from planned to shipped, a `tsup.scripts.config.ts` entry, and (for in-container
  commands) a `Dockerfile` COPY line. Placeholders are categorically rejected.
- **Build and packaging.** ESM TypeScript source, tsup compilation to ESM Node 24, shared CLI
  helpers under `scripts/_lib/`, business logic delegated to pure services per ADR-0007.
- **Validation baseline.** Every implementation PR runs `pnpm build:scripts`, `pnpm typecheck`,
  `pnpm lint`, `pnpm test`, the relevant `pnpm test:integration`, and verifies that every documented
  `remit:*` resolves to an existing compiled file.
- **Backup archive format.** A single-file `.remitbak` archive with a fixed 64-byte plaintext header
  (magic, `archiveFormatVersion`, encryption algorithm byte, IV, key fingerprint), an AES-256-GCM
  ciphertext body reusing the master `REMIT_ENCRYPTION_KEY` per ADR-0005, and a decrypted payload
  that is a gzip-compressed tar carrying `manifest.json` first, then `checksums.sha256`, then a
  `pg_dump --format=custom` database dump, then a flat `uploads/` mirror. The format is versioned so
  future revisions can extend it without breaking existing archives.
- **Restore safety.** Restore is destructive and is guarded by a mandatory pre-restore snapshot,
  typed-name confirmation, refusal on format-version mismatch, key-fingerprint mismatch, archive
  newer than the running build, and per-file checksum failure. Audit-log entries bracket the
  destructive step.
- **Upgrade execution model.** Upgrade is host-side only. There is no `remit:upgrade` package
  script; the name is not reserved. The shipped upgrade flow lives at `scripts/host/upgrade.sh`,
  invokes `docker compose exec app pnpm remit:backup`, runs `docker compose pull` then
  `docker compose up -d`, and polls the health check. The container entrypoint applies pending
  migrations on every start.
- **Encryption key rotation.** The script name `remit:rotate-encryption-key` is reserved. The
  rotation semantics — two-key window, re-encryption of all encrypted columns and existing backup
  archives, settings-row migration, refusal-to-start with a mid-rotation database — will be settled
  in a dedicated ADR when implementation begins. No package script ships before that ADR.

Implementation-facing detail (byte layout, manifest JSON shape, per-command status, validation
table) lives in
[Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience). This ADR
records the macro decision so that the contract has a stable point of reference; later changes to
the byte layout, encryption algorithm, restore refusal rules, or upgrade model bump the appropriate
format version and are recorded in a new ADR that supersedes this one. This ADR is not rewritten in
place once any implementation has shipped against it.

## Consequences

### Positive

- Every `remit:*` command — shipped or planned — has one place to read for naming, execution
  context, promotion criteria, and validation.
  [Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience) is that
  place.
- Placeholder scripts that advertise unshipped behaviour are categorically rejected by the promotion
  criteria.
- The privacy- and security-first posture is preserved: the app container is never granted Docker
  daemon access; upgrade is honestly host-side.
- Backup archives have a precise, versioned byte layout. Restore code can be implemented and
  fixture-tested deterministically; older restores correctly refuse newer archive versions.
- Restore is destructive but never silent: a mandatory pre-restore snapshot, typed confirmation, and
  refusal rules make accidental data loss require deliberate operator action.
- Reusing `REMIT_ENCRYPTION_KEY` for both column encryption and backup encryption avoids inventing a
  second secret operators must manage and rotate.
- ADR sprawl is avoided. The contract is one macro decision, not one ADR per command.

### Negative

- [Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience) carries
  operational implementation detail (byte layout, manifest JSON) that a reader looking only at
  "self-hosting" may not expect there. The trade-off is intentional: collocating the planning
  narrative with the spec keeps the source of truth singular.
- Reusing `REMIT_ENCRYPTION_KEY` means losing that key loses both encrypted columns and all backups.
  The operator-facing key-safekeeping guidance must emphasise this; the (future) key-rotation ADR
  introduces a two-key window that mitigates the rotation case.
- A single-destination-per-backup-run policy means an operator who wants redundant remote backups
  runs `remit:backup` twice. The simplicity trade-off is intentional; fan-out is a future revision
  recorded in a new ADR if added.
- "One-command upgrade" is a host-side experience rather than `docker exec ... pnpm remit:upgrade`.
  README.md and
  [Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience) must
  describe this honestly so operator expectations match reality.

## Alternatives considered

### One ADR per operational script

The first draft of this contract split the macro decision across three ADRs: a contract ADR, a
backup-archive-format ADR, and an upgrade-execution-model ADR. The split was rejected because the
rules are shared and the spec is forward-looking. The contract ADR and the format/model sub-ADRs
covered the same conceptual decision from different angles; a single ADR with the durable spec in
[Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience) is honest and
avoids duplication.

### Document the contract in a standalone `docs/architecture/operations/CLI-CONTRACT.md`

An earlier iteration kept the contract in a sibling document under `docs/architecture/operations/`.
It was rejected because Architecture is the single source of truth for forward-looking technical
decisions; a sibling document creates two places to keep in sync and an extra layer of indirection
for readers. [Architecture: Self-hosting experience](../ARCHITECTURE.md#14-self-hosting-experience)
already exists, already describes self-hosting end-to-end, and is the natural home for the contract.

### Allow the app container to mount the Docker socket and orchestrate its own upgrade

This would enable `pnpm remit:upgrade` inside the container. It was rejected because mounting the
Docker socket gives the application full control over the host's Docker daemon — a single
application vulnerability becomes a host compromise. The ergonomic gain does not justify the
escalation surface.

### `pg_dump --format=plain` for the database payload

A plain SQL dump is human-readable. It was rejected because the custom format compresses better,
restores faster, and supports `pg_restore --clean --if-exists` cleanly without role assumptions on
the target instance. Human inspection of an encrypted production backup is rare and not the right
design constraint.

### Separate dedicated backup encryption key (e.g., `REMIT_BACKUP_KEY`)

A backup-only key would decouple backup rotation from column-encryption rotation. It was rejected
for the initial release because it doubles the secret-management surface without solving a concrete
problem we have today. The (future) key-rotation ADR can introduce a separate key if rotation
semantics demand it.

### Multi-file archive (manifest next to dump next to uploads tree)

Storing components as adjacent files would simplify partial restores. It was rejected because the
operator workflow — "save this file, restore from this file" — is much clearer with a single
artefact, and partial restore is not a goal at this stage.

### `age` or external encryption tooling

`age` would offload format and key-management complexity to a battle-tested library. It was rejected
because Remit already uses Node's built-in AES-256-GCM for column encryption and a backup should
reuse the same key. Adding `age` would add a third-party dependency and a parallel key ecosystem.
