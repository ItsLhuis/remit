# Delivery records

A delivery record answers one question no other document in this repository answers: **what was
built, why, how, and how it was known to work**.

The neighbouring documents each own a different question, and a record must not repeat them.

| Document            | Unit           | Answers                                           | Changes? |
| ------------------- | -------------- | ------------------------------------------------- | -------- |
| ADR                 | one decision   | why this way and not another                      | never    |
| `ARCHITECTURE.md`   | the system     | how it is today                                   | in place |
| `SCHEMA.md`         | the database   | every column, constraint and index                | in place |
| `docs/operations/`  | one procedure  | how an operator runs it                           | in place |
| **Delivery record** | one capability | what was built, why, how, and how it was verified | sealed   |

An ADR records the choice. A record records the delivery. `ARCHITECTURE.md` records the result. A
record **cites** an ADR and never restates it.

## The record

Filename `NNNN-slug.md`, zero-padded to four digits. Referred to in prose as `DR-0018`, the way
`ADR-0028` is.

Front matter uses the same bold-bullet form the ADRs use:

```markdown
- **Status:** Shipped
- **Date:** 2026-08-25
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0019, ADR-0028
- **Supersedes:** —
- **Reconstructed:** yes
```

Then seven sections, in this order, with no others:

- **What** — one sentence. The record must be legible from its title and this line alone.
- **Why** — the problem that existed before. Not the solution.
- **Scope** — what was included, and what was deliberately excluded with the reason. The exclusions
  are usually the more valuable half.
- **How** — the shape of the implementation and what makes it non-obvious. Not a tutorial; the
  detail lives in the code, and this section carries what the code cannot say.
- **Evidence** — the files and tests that support everything above. **A claim with no reference does
  not enter the record.**
- **Verification** — how it was known to work, and what was not covered, said in words.
- **Known gaps** — what was true on the day of delivery.

## Status and verdict

`Status` is the lifecycle. `Verdict` is the quality of the delivery.

| Field     | Values                                 |
| --------- | -------------------------------------- |
| `Status`  | `In progress`, `Shipped`               |
| `Verdict` | `Complete`, `Complete with known gaps` |

A record opens at `Status: In progress` with **What**, **Why** and **Scope** filled, and is
committed in that state. It seals at `Status: Shipped` when the work ships and every gate passes,
with the remaining sections filled and `Date` set to the delivery date.

A committed in-progress record is deliberate: it is also the marker that says a capability was
started and not finished, which is the signal this repository had no way of leaving behind.

**A record never seals over unfinished work.** `Status: Shipped` with an empty **Evidence** or
**Verification** section fails `tests/docs/delivery.test.ts`.

## Immutability

A sealed record is immutable, like an ADR. Later work on the same capability is a **new record**
carrying `Supersedes: DR-NNNN`; the index, not the record, carries which one is current.

**Known gaps** in particular is never updated. It is what was true on the day, and whoever closes a
gap writes their own record. A record edited as the world changes becomes a second `ARCHITECTURE.md`
that drifts from the first, and loses the only property that makes it worth keeping: that it is true
of a moment.

## Granularity

The unit is the **capability** — one thing the product does that a user or an operator would name.
If two pieces of work would be described to a user as one feature, they are one record. The unit is
not the work session and not the feature module: `features/clients` holds both clients and their
contacts, and `features/invoices` holds the public invoice view.

## Reconstruction

`Reconstructed: yes` marks a record written after the fact from the repository — commits, code, ADRs
and runbooks — rather than at delivery time by whoever did the work. Such a record carries only what
the repository can still support. Where the reasoning behind a choice was not written down anywhere,
the record says so rather than inventing one.

Records without the field were written at delivery time.

## Index

Oldest first, matching the ADR index, so the numbers read as the order the product was built in.

| Record                                          | Capability                                     | Date       | Verdict                  | Decisions                                        |
| ----------------------------------------------- | ---------------------------------------------- | ---------- | ------------------------ | ------------------------------------------------ |
| [0001](0001-application-foundation.md)          | Application foundation, containers and health  | 2026-06-01 | Complete                 | ADR-0011, ADR-0020                               |
| [0002](0002-authentication-and-totp.md)         | Authentication, onboarding and mandatory TOTP  | 2026-05-13 | Complete                 | ADR-0003, ADR-0012, ADR-0013                     |
| [0003](0003-encryption-at-rest.md)              | Encryption at rest                             | 2026-05-28 | Complete                 | ADR-0005                                         |
| [0004](0004-internationalisation.md)            | Internationalisation                           | 2026-05-16 | Complete                 | ADR-0015                                         |
| [0005](0005-file-storage-and-uploads.md)        | File storage adapters and uploads              | 2026-05-19 | Complete                 | ADR-0019                                         |
| [0006](0006-audit-log-and-hardening.md)         | Security audit log and HTTP hardening          | 2026-05-08 | Complete with known gaps | ADR-0001                                         |
| [0007](0007-design-system.md)                   | Design system and appearance preferences       | 2026-06-14 | Complete                 | —                                                |
| [0008](0008-email-delivery.md)                  | Email delivery adapters                        | 2026-05-30 | Complete                 | ADR-0008                                         |
| [0009](0009-instance-settings.md)               | Instance settings surface                      | 2026-08-04 | Complete with known gaps | ADR-0016                                         |
| [0010](0010-leads-clients-and-contacts.md)      | Leads, clients and client contacts             | 2026-08-21 | Complete                 | ADR-0027                                         |
| [0011](0011-projects-and-tasks.md)              | Projects and tasks                             | 2026-07-28 | Complete                 | ADR-0004                                         |
| [0012](0012-template-editor.md)                 | Template editor                                | 2026-07-27 | Complete                 | ADR-0024                                         |
| [0013](0013-proposals.md)                       | Proposals and public acceptance                | 2026-07-29 | Complete                 | ADR-0017                                         |
| [0014](0014-contracts.md)                       | Contracts and public signing                   | 2026-08-01 | Complete                 | ADR-0017, ADR-0022                               |
| [0015](0015-invoices-and-credit-notes.md)       | Invoices, public view and credit notes         | 2026-08-03 | Complete with known gaps | ADR-0009, ADR-0017                               |
| [0016](0016-payments.md)                        | Payments and Stripe settlement                 | 2026-08-03 | Complete with known gaps | ADR-0009                                         |
| [0017](0017-recurring-invoices-and-jobs.md)     | Recurring invoices and the job runtime         | 2026-08-05 | Complete with known gaps | ADR-0023                                         |
| [0018](0018-time-tracking-and-expenses.md)      | Time tracking and expenses                     | 2026-08-06 | Complete with known gaps | ADR-0017                                         |
| [0019](0019-activity-log.md)                    | Activity log                                   | 2026-08-07 | Complete with known gaps | ADR-0006                                         |
| [0020](0020-dashboard-and-reports.md)           | Dashboard and reports                          | 2026-08-18 | Complete with known gaps | ADR-0007                                         |
| [0021](0021-team-management.md)                 | Team management and roles                      | 2026-08-12 | Complete                 | ADR-0013                                         |
| [0022](0022-data-export.md)                     | Account data export                            | 2026-08-13 | Complete                 | ADR-0010, ADR-0019                               |
| [0023](0023-document-pipeline.md)               | Document pipeline — PDF rendering and email    | 2026-08-14 | Complete with known gaps | ADR-0022, ADR-0023                               |
| [0024](0024-document-parentage.md)              | Document parentage integrity                   | 2026-08-20 | Complete                 | ADR-0026                                         |
| [0025](0025-attachments-and-visual-identity.md) | Attachments and visual identity                | 2026-08-25 | Complete with known gaps | ADR-0019, ADR-0028                               |
| [0026](0026-encrypted-backup.md)                | Encrypted backup and remote destinations       | 2026-05-23 | Complete with known gaps | ADR-0019, ADR-0020                               |
| [0027](0027-restore.md)                         | Restore from an encrypted archive              | 2026-05-26 | Complete                 | ADR-0020                                         |
| [0028](0028-encryption-key-rotation.md)         | Encryption key rotation                        | 2026-05-28 | Complete                 | ADR-0021                                         |
| [0029](0029-demo-seeding-and-data-reset.md)     | Demo data seeding and instance data reset      | 2026-08-18 | Complete                 | ADR-0025                                         |
| [0030](0030-host-side-upgrade.md)               | Host-side upgrade                              | 2026-05-26 | Complete                 | ADR-0020                                         |
| [0031](0031-delivery-records.md)                | Delivery records and the documentation surface | 2026-09-01 | Complete                 | —                                                |
| [0032](0032-documentation-reconciliation.md)    | Documentation reconciliation                   | 2026-09-03 | Complete with known gaps | ADR-0010, ADR-0014, ADR-0018, ADR-0023, ADR-0025 |
| [0033](0033-public-token-lifecycle.md)          | Public token lifecycle                         | 2026-09-04 | Complete with known gaps | ADR-0029                                         |
| [0034](0034-public-client-portal.md)            | Public client portal                           | 2026-09-05 | Complete with known gaps | ADR-0029, ADR-0030                               |

Every record above carries `Reconstructed: yes` except `DR-0031`, `DR-0032`, `DR-0033` and
`DR-0034`, which were written at delivery time.
