# Behaviour and interface defects

- **Status:** Shipped
- **Date:** 2026-10-06
- **Verdict:** Complete
- **Decisions:** ADR-0029
- **Supersedes:** —

## What

A dozen small defects that each made the owner's or a client's experience wrong in one specific way
— a misleading error, a disabled button, an unlabelled value, a field nothing writes, a link that
silently stays off, a check that cries wolf, a clipped figure — are fixed where they live, each with
a test that would have caught it.

## Why

Each of these was found by a stage that was told to record rather than fix it. A failed create
reported "update failed"; the public proposal form disabled its button until the email field lost
focus, so typing an address and clicking straight through did nothing; the recurring invoice summary
left a screen reader no way to pair a value with its label; nothing in the application wrote a
client's locale; a restored client came back without its portal link and nothing said so; the README
called demo seeding deterministic though its bearer tokens are random; the missed-backup banner gave
no date; the public-URL health check could not tell an unreachable address from one whose
certificate the container does not trust; public token routes dropped `X-Frame-Options` while their
policy forbade framing anyway; and a report PDF clipped a wide figure or a long row label.

## Scope

Included: the action-error fallbacks of every feature whose helper names the wrong operation; the
public forms that gate submit on a validity their mode cannot yet know; the recurring invoice
summary's label association; a client locale field; what a client restore does and says about the
portal link; the demo-seeding documentation; the missed-backup banner's dates; the public-URL
check's certificate state; one framing policy for every route; report PDF figures and row labels
that never lose a character.

Excluded: a redesign of any surface these defects live on, which is the owner's own design pass;
documents, document emails and public document pages honouring a client's locale, which is a
separate defect recorded in the pack's register.

## How

**Error messages name the operation.** Every feature's action-error helper takes the fallback
message from its caller and has no default of its own, so the compiler refuses a call that does not
say which operation failed. Creating a client, a lead, a project, a task, a proposal or a tax rate
reports a create failure; deleting reports a delete failure; every restore, in every feature that
has one, reports the trash's restore failure instead of the update or delete message it borrowed.
Converting a lead says so. The new keys sit beside the existing ones per feature.

**Public forms submit in one motion.** The public proposal identity form and the contract signing
form validate on blur and had gated their buttons on that validity, which a field still being typed
into cannot have yet. Neither gates on validity now; submitting runs the resolver and shows each
message in `FieldError`, as the one-time-code form already did. The consent box still validates as
soon as it is ticked, so an error shown by a failed submit clears at once.

**Labelled summary values.** `components/ui/DescriptionList.tsx` is a new primitive — a `<dl>` with
its item, term and details — and the recurring invoice summary renders each row through it. Each
value carries `aria-labelledby` pointing at its term, because a `definition` has no accessible name
of its own; a value is now reachable by its label from assistive technology and from a test.

**Client locale.** `clients.locale` drives how amounts and dates are written in the client's portal,
and nothing else today. The client form gains a formatting-locale select, modelled on the instance's
regional defaults, whose first option is the instance default (stored as null).
`lib/utils/locale.ts` holds the closed list of regional BCP 47 tags a record may carry; a tag
outside it is refused, because `Intl` silently formats an unknown tag as its own default and a typo
would look like an ignored setting. The column joins the audited client fields, and lead conversion
sends the instance default. Documents, document emails and the public document pages still format
with the instance locale, which is recorded as its own gap.

**Restore and the portal link.** A restored client's portal link stays revoked. Minting a fresh link
on restore was rejected: the owner restores a record, not its exposure, and ADR-0029 made
re-enabling a portal an explicit act. The restore's audit entry now records `portalLink: "none"`,
the trash's restore message for a client says the link stays off and where to enable a new one, and
the client page already shows the portal as off with the one action that issues a link.

**Honest surfaces.** The README, the install guide, `ARCHITECTURE.md`, `CLI-CONTRACT.md` and the
command list in `AGENTS.md` describe demo seeding as the same for the same seed except its public
tokens, which are minted at random because they are bearer credentials; predictable tokens were not
considered. A docs test keeps any of those documents from calling it deterministic again. The
missed-backup banner states when the last backup succeeded, and for a failed run when it failed,
formatted with the instance's locale and time zone. The public-URL health check reads the code
Node's fetch carries on its error and reports a certificate this container does not trust as its own
informational state — the address answered, browsers that trust the certificate are unaffected, and
the copy names `NODE_EXTRA_CA_CERTS` — while a refused, unresolved or timed-out connection stays
"unreachable". Certificate verification is never disabled.

**Stale images.** The browser-cache defect could not occur: every replaceable image — avatar, logo,
client image, template image — is stored under a key the upload route mints at random for each
upload, and nothing writes a public object under an existing key, so a replacement always has a new
URL. A test now pins that, since the storage route's `immutable` caching depends on it.

**Framing.** No route is frameable. `applySecurityHeaders` sets `X-Frame-Options: DENY` on every
response beside the unconditional `frame-ancestors 'none'`, so the two agree everywhere; the public
token routes only add the crawler directive. Every one of them carries a control a framing page
could steer a client into — paying, accepting with a one-time code, signing — and the portal links
to all three. Allowing an invoice to be embedded was rejected: nothing embeds one, and a hijacked
payment or signature costs more than a link opened in a new tab. The anonymous storage route keeps
setting neither header, because a stored file has no control to hijack. `ARCHITECTURE.md`'s header
table and its explanation now say this.

**Report PDFs.** `layoutReportColumns` in `features/reports/services/reportDocumentPages.ts` sizes
the figure columns from the widest figure the document prints, measured in its printed form. A
figure keeps the base size when it fits; otherwise it shrinks to the smallest comfortable size; then
the figure columns widen at the row label's expense, because a label can wrap and a figure cannot;
only then does it shrink further, to whatever fits. Widening first was rejected because it narrows
every label even when a slightly smaller figure would do. Row labels and details are no longer
clamped: `getReportRowHeight` estimates each wrapped line count from conservative glyph widths,
pagination measures with that height and the document prints each row at exactly that height, so a
row is never clipped and never split across pages. Header labels keep their own size.

## Evidence

- Error fallbacks:
  `features/{clients,contracts,invoices,proposals,recurringInvoices}/mutationContext.ts`, the
  action-error helpers in
  `features/{expenses,leads,projects,tasks,templates,timeTracking}/mutations.ts` and
  `features/settings/tax-rates/mutations.ts`, every caller in those features and in
  `features/{contracts,invoices,proposals,clients}/restoreMutations.ts`,
  `features/creditNotes/mutations.ts`, `features/payments/mutations.ts`,
  `features/clients/{forgetMutations,imageMutations}.ts`; keys in `lib/i18n/types.ts` and
  `lib/i18n/locales/en.tsx`
- Public forms: `features/proposals/components/PublicProposalPage/PublicProposalIdentityForm.tsx`,
  `features/contracts/components/PublicContractPage/PublicContractSignForm.tsx`
- Summary card: `components/ui/DescriptionList.tsx`,
  `features/recurringInvoices/components/RecurringInvoiceDetailPage/RecurringInvoiceSummaryCard.tsx`
- Client locale: `lib/utils/locale.ts`, `features/clients/schemas.ts`,
  `features/clients/mutations.ts` (`toClientWriteValues`, the audited fields),
  `features/clients/queries.ts` (`toClientFormData`),
  `features/clients/components/ClientForm/ClientProfileSection.tsx`, `features/leads/mutations.ts`
- Restore: `features/clients/restoreMutations.ts`,
  `features/trash/components/TrashSection/TrashTable.tsx`
- Seeding documents: `README.md`, `docs/operations/INSTALL.md`, `docs/architecture/ARCHITECTURE.md`,
  `docs/architecture/operations/CLI-CONTRACT.md`, `AGENTS.md`
- Banner: `features/backups/{types,queries}.ts`,
  `features/backups/components/BackupStatusBanner.tsx`
- Health check: `features/health/services/evaluateHealth.ts` (`classifyPublicUrlProbeFailure`),
  `features/health/queries.ts` (`probePublicUrl`)
- Framing: `lib/securityHeaders.ts`, `proxy.ts`, `docs/architecture/ARCHITECTURE.md` (HTTP security
  headers)
- Report PDFs: `features/reports/services/reportDocumentPages.ts` (`layoutReportColumns`,
  `estimateWrappedLines`, `getReportRowHeight`), `features/reports/services/reportDocument.ts`
- Tests: `features/proposals/__tests__/mutations.integration.test.ts` and
  `features/clients/__tests__/mutations.integration.test.ts` (the failure names the operation; the
  locale is stored, cleared and refused), `PublicProposalIdentityForm.test.tsx` and
  `PublicContractSignForm.test.tsx` (submits in one motion; still refuses invalid input),
  `RecurringInvoiceSummaryCard.test.tsx` (each value addressed by its label),
  `lib/utils/__tests__/locale.test.ts`, `features/trash/__tests__/restore.integration.test.ts` (a
  revoked portal token is never restored), `tests/docs/demoSeeding.test.ts`,
  `features/backups/components/__tests__/BackupStatusBanner.test.tsx`,
  `features/health/services/__tests__/evaluateHealth.test.ts`,
  `app/api/upload/__tests__/upload-routes.test.ts` (a new key for every replacement image),
  `tests/applySecurityHeaders.test.ts` and `__tests__/proxy.test.ts` (both framing headers on a
  public and a private route), `features/reports/services/__tests__/reportDocumentPages.test.ts` and
  `reportDocument.test.ts` (every figure fits its column; wrapped rows grow and never overfill a
  page)

## Verification

On a twelve-core Windows host with 16 GB of memory, against the development and test stacks.

- `pnpm typecheck` passes. `pnpm lint` reports no errors and only its two standing `max-lines`
  warnings, in `features/templates/engine/useCanvasEngine.ts` and `features/templates/schemas.ts`,
  neither touched here. `pnpm format:check` passes.
- `pnpm test:coverage`: 2,700 tests in 307 files, no failure, exit 0. Services 97.01% statements,
  92.46% branches, 97.43% functions. The first run failed three tests: two pinned the behaviour this
  change replaced on purpose — the proxy test that asserted a public token route may be framed, and
  the seeding guard, which caught the "deterministic" wording still in `CLI-CONTRACT.md`'s table —
  and both were updated; the third, `CreateApiTokenDialog.test.tsx`, passed alone and in the full
  run after it.
- `pnpm test:integration`: 910 tests in 98 files, no failure. An earlier run failed every file on a
  refused connection because the test stack's containers were not running; it passed once they were.
- `pnpm vitest run tests/docs` passes.
- `pnpm build` passes, and `pnpm test:e2e` against the production build passed with the instance
  already owned (flow 1's registration skips for that reason). Two specs needed updating for the
  defects they had worked around: the recurring flow reached the summary's "Next run" value through
  the sibling `<span>` the old card rendered, and now reaches it through the term's
  `aria-labelledby` link, because Playwright's role engine computes no name for a `definition` while
  Chromium's accessibility tree does; and the proposal flow no longer blurs the email field before
  submitting, so it walks the identity form the way a client does. The proposal flow's first run
  failed because no job worker was running to send the proposal email, which the spec needs locally
  and does not say; it passed with `pnpm dev:worker` running.
- react-doctor: no error, and none of its 26 standing warnings on a file this change touched.
- `fallow audit` against the base commit reports no dead code and no complexity introduced. It
  attributes three clone groups to the change, each standing scaffolding that grew by the lines this
  change added: the lead and project error helpers beside their `emptyToNull`, the client profile
  section's controller markup beside the invoice form's, and the client mutations' gate prologue.
- Observed rather than inferred:
  - The response headers of the production build on `/api/health`, `/login`, `/i/[token]` and
    `/p/[token]` all carry `X-Frame-Options: DENY` and `frame-ancestors 'none'`; the two public
    token routes add `X-Robots-Tag: noindex, nofollow`.
  - Chromium's accessibility tree names a summary value by its term ("Next run") through
    `aria-labelledby`.
  - The widest report — six figure columns, amounts above twelve million, labels and details of four
    and five lines, two currencies — rendered in Chromium in `en`, `de-DE`, `fr-FR`, `pt-PT` and
    `ja-JP` with every wrapped cell's lines inside its row and no page's table reaching its footer.
    The `fr-FR` PDF, rasterised and read back through pdf.js, prints every digit of every figure and
    every line of every label.
  - Node's fetch reports `SELF_SIGNED_CERT_IN_CHAIN` and `CERT_HAS_EXPIRED` for untrusted
    certificates and `ECONNREFUSED`, `ENOTFOUND` and `UND_ERR_CONNECT_TIMEOUT` for unreachable
    hosts, the codes `classifyPublicUrlProbeFailure` sorts.
  - A failed proposal and client create report the create message, a lead conversion submits a
    client with the instance-default locale, a restored client keeps its portal link off, and the
    banner states its dates — each through the tests named under Evidence, not in a browser.

Not covered: the health page itself against a deployment with a self-signed certificate, and the
client portal rendered in a browser with a client locale set; both are exercised by the tests above
at the layer that decides them. No component-review agent was available to run over the change.

## Known gaps

None.
