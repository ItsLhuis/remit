# DR-0008: Email delivery adapters

- **Status:** Shipped
- **Date:** 2026-05-30
- **Verdict:** Complete
- **Decisions:** ADR-0008
- **Supersedes:** —
- **Reconstructed:** yes

## What

SMTP and Resend as interchangeable transactional email backends, configured from the settings
surface with a test send, and an `email_logs` record of what was sent.

## Why

Remit sends password resets, team invitations and documents to clients. A self-hosted product cannot
assume a vendor: an operator with their own mail server should use it, one who does not want to run
mail should be able to use a provider, and neither choice should be a fork. Email is also the most
common thing to be misconfigured, so the operator needs to find that out from a test button rather
than from a client who never received an invoice.

## Scope

Included: the adapter interface with nodemailer-backed SMTP and Resend SDK implementations, the
settings form with an encrypted password or API key, a test send, the `isEmailConfigured` predicate
the rest of the product branches on, and the `email_logs` table.

Excluded: a bundled mail server. Remit sends mail, it does not run an MTA. Also excluded is any
queue or retry policy at this layer — delivery of documents is queued later, by the document
pipeline, and putting retries in the adapter would have given two layers the same responsibility.

## How

The adapter boundary is the point of ADR-0008: the calling code names a recipient, a subject and a
body, and never knows which backend carried it. That is what makes the provider a settings choice
rather than a code change.

`isEmailConfigured` is a pure predicate exported from the email feature and consumed elsewhere,
which is why the password reset flow can decide between the email path and the CLI path without
importing anything about SMTP. ADR-0012 depends on that predicate being cheap and honest.

The SMTP password and the Resend API key are `encryptedColumn()` values, so they are ciphertext at
rest and never appear in a log or a response.

## Evidence

- `features/email/services/isEmailConfigured.ts`, `features/email/transactional.ts`,
  `features/email/server.ts`
- `features/settings/email/` — mutations, queries, schemas and the settings form
- `database/schema/emailLogs.ts`, `database/schema/settings.ts` — the encrypted credential columns
- `docker-compose.dev.yml` — the Mailpit development mail sink
- `docs/architecture/adr/0008-email-adapters.md`

## Verification

`features/email/__tests__/transactional.test.ts` covers the send path with the provider SDKs stubbed
at the module boundary. `features/settings/email/__tests__/mutations.integration.test.ts` and
`schemas.test.ts` cover configuration writes and validation, and
`EmailSettingsPage/__tests__/EmailSettingsForm.test.tsx` covers the form including the test-send
control. Local development sends into Mailpit, so the SMTP path is exercised end to end by hand
without reaching a real mailbox.

Not covered by an automated test: a real Resend account or a real external SMTP server. Both are
verified only against stubs and Mailpit.

## Known gaps

`email_logs.provider_message_id` existed with neither a reader nor a writer at this point. The three
`email_logs` writers were given one later; see `DR-0025`.
