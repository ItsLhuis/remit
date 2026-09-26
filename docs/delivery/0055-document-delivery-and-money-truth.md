# Document delivery and money truth

- **Status:** Shipped
- **Date:** 2026-09-25
- **Verdict:** Complete
- **Decisions:** ADR-0043, ADR-0044
- **Supersedes:** —

## What

Every document Remit sends reaches the client without an owner-made template, and every surface that
states, charges or exposes what an invoice still owes — the owner's screens, the public invoice
page, the client portal, hosted checkout, reminders, late fees, the public API and the MCP tools —
states one amount, derived once, that agrees with when the invoice counts as settled.

## Why

A new instance has no templates, and the invoice, proposal and credit note renderers returned
without a document when they found none: the owner pressed Send, the document was marked sent and
its public link published, and no mail was ever attempted. The only trace was an audit entry. The
templates page meanwhile told the owner that the missing types "fall back to the built-in layout",
which did not exist. A late fee reached a document only if the owner's own template happened to
place its merge variable.

What an invoice still owes was computed in two incompatible ways. The owner's invoice screen, the
credit-note editor, the client portal, the dashboard and the revenue report subtracted the credit
notes issued against the invoice; the public invoice page, hosted checkout, "mark as paid", the
invoice list, the client list and health, the invoice and reminder emails, the late-fee base, the
`invoice.amountDue` merge variable, the public API and the MCP tools did not. A client opening a
credited invoice was quoted two different amounts, and the card path charged the larger. Settlement
itself counted payments only, so an invoice whose credit notes and payments together covered its
total stayed unpaid for ever: it went overdue, drew reminders for money nobody owed, could be
charged a late fee on that phantom balance, and "mark as paid" would book a payment for it.

The public API's invoice detail omitted the outstanding amount its own list row carried, and both
the API and the MCP tools exposed only the stored status, so a consumer could not see the overdue or
partially paid state every badge in the application shows.

## Scope

Included: a built-in layout for every document type that renders from a template, resolved when the
instance has none of that type; sending that always attempts the mail; the templates page copy; a
late fee made discoverable in the editor and flagged when an owner's template omits it; one pure
definition of an invoice's outstanding amount, netting payments and credit notes, behind every
surface that computes, shows, charges or exposes it, with its SQL mirror where a query sorts or
filters on it; settlement that counts credit notes as the owner decided, re-evaluated when a credit
note is issued, deleted or restored; the credit notes applied to an invoice on its public page; the
API invoice detail's outstanding amount; the derived status beside the stored one in the API and the
MCP tools, documented in the OpenAPI output.

Excluded: the template editor, the block model and the renderer, which are extended and not
redesigned; the API's scope and its resources; a separate email path for credit notes, which does
not exist and is a product question rather than a delivery defect; and a contract layout, because a
contract snapshots its own blocks and cannot be sent without them, so it never renders from a
template.

## How

**Built-in layouts** ([ADR-0043](../architecture/adr/0043-built-in-document-layouts.md)). The layout
of every invoice, proposal and credit note is chosen in one place, `resolveDocumentLayout`: the
document's own template, the instance default, else a block tree built in code. The built-in goes
through `renderTemplate` like any template, so the renderer, its sanitizer and ADR-0022's single
preview-to-PDF path are unchanged. Because it is built per document, it sizes the line-items table
to the lines, places the totals below it, and leaves out a figure that does not apply — a late fee
never charged or waived, a credit nothing issued, a zero discount or payment. It follows
`DESIGN.md`: achromatic, hairline panels, right-aligned figures, the one accent on the amount the
reader acts on; figures stay in the page's sans face because the renderer loads no web font and
JetBrains Mono falls back to Courier there. A template with an empty canvas counts as none. The
render jobs lost their `noTemplate` branch: a live document always has a layout, so a send always
chains its mail. Sending on an instance with no mail provider — the one remaining case where no mail
is attempted — now warns at the moment of sending instead of reporting success. The templates page
names the case that applies: a type without a default uses Remit's built-in version, and a contract
needs a template of its own.

**Late fees on the document.** The built-in invoice prints the fee whenever one is charged. Charging
or adjusting a fee clears the stored PDF pointer in the same statement and enqueues a render,
because the send-time PDF states a total the invoice no longer has and every later reminder attaches
it. An owner whose own template has no `invoice.lateFee` sees that on the invoice's late-fee card,
decided by `placesMergeVariable` over the blocks the invoice would render with, hidden blocks
excluded.

**One outstanding amount**
([ADR-0044](../architecture/adr/0044-invoice-outstanding-and-credit-settlement.md)).
`getInvoiceOutstandingCents` takes the credited sum and every surface calls it; the parallel helper
in the credit-notes feature and the dashboard's own formula were removed. Reads that sort or
aggregate in SQL restate it once each, the invoice list in `features/invoices/queryFragments.ts` and
the client list in `features/clients/queryFragments.ts`, which could not import the first without an
import cycle, and each restatement is pinned by an integration test. The client balance became a sum
of per-invoice outstanding amounts rather than invoice totals less payments, so an over-credited
invoice cannot hide another's debt.

**Settlement.** When the two definitions were reconciled, settlement ignored credit notes and a
credited invoice paid for its remainder could never close. The owner decided that credit notes
settle an invoice. `evaluateInvoiceSettlement` settles exactly when the outstanding amount reaches
zero on a positive total; the overpayment bound stays at the total so money that did arrive is never
refused. Every payment write reads the credited sum under the invoice lock, and issuing, withdrawing
or restoring a credit note calls `resettleInvoiceWrite` in its own transaction. A credit-note insert
takes a key-share lock on the invoice that waits for a payment's `FOR UPDATE`; a withdrawal or
restore takes the lock before deciding, so whichever write commits last re-reads the other.
Migration `0011_settle_credited_invoices` settles the invoices already covered. "Mark as paid" books
the credited remainder, and hosted checkout charges it, with the idempotency key carrying the new
amount.

**The public invoice page** lists the credit notes applied — number, date and amount, the fields the
portal already shows, with no id — and its settled state shows what was paid rather than the total.
Its summary also states a charged late fee, which it had left out, so the lines it lists add up to
the total it prints.

**API and MCP.** Both invoice schemas gained `displayStatus`, derived by `deriveInvoiceStatusView`
when the response is built, beside the stored `status`, each described in the OpenAPI output; the
detail gained `outstandingCents`. Both are additive under ADR-0038. The MCP tools publish them
through the same schemas, and the server instructions tell the model to read them rather than derive
overdue itself.

## Evidence

- `features/templates/services/builtInLayout.ts`, `builtInLayoutSpec.ts`,
  `builtInLayoutSections.ts`, `features/templates/documentLayout.ts`,
  `features/templates/services/mergeVariables.ts` (`placesMergeVariable`, `invoice.credited`,
  `creditNote.invoiceNumber`)
- `features/invoices/pdfDocument.ts`, `features/proposals/pdfDocument.ts`,
  `features/creditNotes/pdfDocument.ts` and their `pdfRenderJob.ts` siblings
- `features/email/documentEmail.ts` (`isDocumentEmailConfigured`), the send actions in
  `features/invoices/mutations.ts`, `features/proposals/mutations.ts`,
  `features/contracts/mutations.ts`
- `features/templates/services/summarizeTemplates.ts`,
  `features/templates/components/TemplatesListPage/TemplatesSummaryBand.tsx`
- `features/invoices/lateFees.ts`, `features/invoices/mutations.ts` (`adjustInvoiceLateFee`),
  `features/invoices/queries.ts` (`shownOnDocument`), `InvoiceLateFeeCard.tsx`,
  `InvoiceLateFeeOffDocumentAlert.tsx`
- `features/invoices/services/invoiceStatusView.ts`,
  `features/payments/services/paymentSettlement.ts`,
  `features/payments/services/invoiceCheckout.ts`, `features/payments/paymentWrites.ts`
  (`decideSettlement`, `resettleInvoiceWrite`), `features/creditNotes/mutations.ts`
- `features/invoices/queryFragments.ts`, `overviewQueries.ts`, `queries.ts`, `publicQueries.ts`,
  `documentData.ts`, `jobs.ts`; `features/clients/queryFragments.ts`, `queries.ts`,
  `publicQueries.ts`, `services/calculateOutstandingBalance.ts`;
  `features/dashboard/services/summarizeReceivables.ts`;
  `features/reports/services/aggregateRevenue.ts`
- `features/invoices/components/PublicInvoicePage/PublicInvoiceSummary.tsx`,
  `features/invoices/components/PublicInvoicePage/PublicInvoicePaymentCard.tsx`,
  `features/invoices/components/PublicInvoicePaidPage/PublicInvoicePaidPage.tsx`,
  `features/clients/components/PublicClientPortalPage/PortalInvoiceRow.tsx`
- `features/api/responseSchemas.ts`, `features/api/services/serializers.ts`,
  `features/mcp/tools.ts`, `features/mcp/buildMcpServer.ts`
- `drizzle/migrations/0011_settle_credited_invoices.sql`
- Tests: `features/templates/services/__tests__/builtInLayout.test.ts`,
  `features/payments/services/__tests__/paymentSettlement.test.ts` (settled exactly when nothing is
  outstanding), `invoiceStatusView.test.ts`, `invoiceCheckout.test.ts`, `serializers.test.ts`,
  `features/invoices/__tests__/pdfRenderJob.integration.test.ts`,
  `features/invoices/__tests__/outstandingSql.integration.test.ts`,
  `features/clients/__tests__/clientOutstanding.integration.test.ts`,
  `features/creditNotes/__tests__/mutations.integration.test.ts`,
  `features/payments/__tests__/stripeCheckout.integration.test.ts`,
  `features/invoices/__tests__/publicInvoice.integration.test.ts`,
  `features/invoices/__tests__/lateFeeAdjustment.integration.test.ts` (the late fee on the
  document), `features/invoices/__tests__/mutations.integration.test.ts` (whether a send was
  mailed), `features/invoices/components/InvoiceDetailPage/__tests__/InvoiceLateFeeCard.test.tsx`,
  `lib/jobs/__tests__/queueRoundTrip.integration.test.ts`, `tests/e2e/recurringGeneration.spec.ts`

## Verification

On a twelve-core Windows host, against the development stack.

- `pnpm typecheck` passes. `pnpm lint` reports no errors and only its two standing `max-lines`
  warnings, in `features/templates/engine/useCanvasEngine.ts` and `features/templates/schemas.ts`,
  neither touched here; its import-cycle pass reports none. `pnpm format:check` passes.
- `pnpm test:coverage`: 2,620 tests in 295 files, no failure, exit 0. Services 97.01% statements,
  92.43% branches, 97.35% functions.
- `pnpm test:integration`: 895 tests in 96 files, no failure. The first full run on this change
  failed three tests whose expectations it changed on purpose — the proposal and contract send
  results, which now say whether the mail went out, and the queue round trip, whose file-wide
  renderer stub now also counts the recurring invoice's built-in render — and they were updated to
  the new behaviour. One later run timed out on a file's first test just after the test database's
  container had restarted; the file passed alone and in every full run since.
- `pnpm vitest run tests/docs` passes.
- `pnpm build` passes, and `pnpm test:e2e` against the production build on the development stack
  passed 26 with 3 skipped, each for its stated reason: flow 1, because the instance already has an
  owner, and both backup flows, because the host has no `pg_dump`. One run failed flow 4: the spec
  waited for the recurring sweep and asserted on the generation, which the sweep only enqueues, and
  the mail jobs that sent documents now chain had queued ahead of it. The spec now waits for the
  generation job; the runs after it passed with the same queue order.
- react-doctor: no error, and none of its 26 standing warnings on a file this change touched.
- `fallow audit` against the base commit reports no dead code and no complexity introduced once it
  was run without a coverage file. It first found a label type restated field for field, one
  settlement decision written five times, a list-row type restated, an unused export and the
  late-fee card over the cognitive-complexity threshold; each was fixed. It still attributes four
  clone groups to the change. Three are clones the base commit already had and this change grew or
  moved — the invoice detail and edit reads' shared opening, the credit-note delete and restore
  actions, the proposal document data and its PDF builder — and the fourth is the credited-sum query
  that `features/payments/paymentWrites.ts` restates for the reason its comment gives. Given the
  unit coverage file, fallow also scores six server-side functions as untested, because it reads
  unit coverage and their tests are integration tests; two of them this change did not modify.
  fallow's full run still exits 1 on its standing advisory backlog.
- The three built-in layouts, printed by the real renderer in Chromium from representative
  documents, read back their figures from the PDF text layer: the invoice with its late fee, credit
  and amount due, the proposal, and the credit note with the invoice it corrects.
- Manual smoke, with the production build and a real worker (`pnpm dev:worker`) on the development
  stack, whose instance has no default invoice template and no proposal or credit-note template.
  Migration 0011 was applied to that database first and matched no invoice. The instance's email
  settings were pointed at the mail sink for the run and cleared afterwards.
  - An invoice billed from a time entry and sent from its page reported success, and its mail
    reached the sink with `INV-0035.pdf` attached, drawn from the built-in layout. A proposal
    created and sent from the UI arrived the same way with `PROP-0016.pdf`.
  - A credit note issued from the UI rendered `CN-0001` from its built-in layout and could be
    downloaded. It has no email path, so nothing was sent.
  - A late fee on the invoice, adjusted to 40.00 from its card, replaced the stored PDF with one
    showing the late-fee line, a total of 240.00 and 240.00 due. The card raised no flag, because
    the built-in layout prints the fee.
  - With the 100.00 credit note issued, the invoice page, the public invoice page, the client
    portal, the API detail and list, and the MCP `get_invoice` and `list_invoices` tools in both
    protocol eras all stated 140.00 outstanding, and the API and MCP gave `displayStatus` `sent`
    beside the stored `sent`, as the page's badge does. The smoke's API token was revoked and the
    instance's MCP switch turned back off.
  - The public invoice page's summary turned out to leave the late fee out, so its lines did not add
    up to its total, and to break the credit-note amount across two lines. Both were fixed here and
    checked again at desktop and phone widths.

Not covered: hosted checkout against Stripe itself, because no test keys were available. What it
charges for a credited invoice is the Checkout Session request `stripeCheckout.integration.test.ts`
captures: the credited balance, with the idempotency key carrying that amount. No component-review
agent was available to run over the change.

## Known gaps

None.
