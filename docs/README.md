# Remit documentation

This directory routes by question. Each document below owns its answer; none of them summarises
another, so start from the question you actually have.

| Question                                        | Go to                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| How is the system built, and why that way?      | [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md)                       |
| What is every table, column, constraint, index? | [`architecture/SCHEMA.md`](architecture/SCHEMA.md)                                   |
| Why was a specific decision taken?              | [`architecture/adr/`](architecture/adr/README.md)                                    |
| What was built, when, and how was it verified?  | [`delivery/`](delivery)                                                              |
| How do I install and start an instance?         | [`operations/INSTALL.md`](operations/INSTALL.md)                                     |
| How do I restore from a backup?                 | [`operations/RESTORE.md`](operations/RESTORE.md)                                     |
| How do I upgrade a running instance?            | [`operations/UPGRADE.md`](operations/UPGRADE.md)                                     |
| What exactly does a `remit:*` command do?       | [`architecture/operations/CLI-CONTRACT.md`](architecture/operations/CLI-CONTRACT.md) |
| What is inside a `.remitbak` archive?           | [`architecture/specs/BACKUP-ARCHIVE.md`](architecture/specs/BACKUP-ARCHIVE.md)       |
| How do I write code that fits this repository?  | [`../.agents/rules/`](../.agents/rules), entrypoint [`../AGENTS.md`](../AGENTS.md)   |
| How do I report a vulnerability?                | [`../.github/SECURITY.md`](../.github/SECURITY.md)                                   |
| What behaviour is expected of participants?     | [`../.github/CODE_OF_CONDUCT.md`](../.github/CODE_OF_CONDUCT.md)                     |
| How do I contribute?                            | [`../.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md)                           |

The four kinds of document here do not overlap. An ADR records a decision and never changes.
`ARCHITECTURE.md` and `SCHEMA.md` describe the system as it is today and are rewritten in place. A
delivery record describes one capability as it was delivered and is sealed. The runbooks describe a
procedure an operator follows under pressure.
