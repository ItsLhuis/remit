---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/__tests__/**"
  - "vitest.config.ts"
  - "playwright.config.ts"
---

# Testing Rules

## What we test

Tests exist to catch regressions in user-observable behavior, never to maximize a coverage number.
Every test must justify its existence by describing a behavior.

### Tier 1 - High coverage (>90%): services and non-trivial hooks

`features/<feature>/services/` contains pure business logic - tax calculations, status transition
guards, invoice number generation, retainer pool tracking, next-run date computation. These are the
brains of the app and are cheap to test because they have no framework dependencies. Coverage above
90% is enforced as a hard CI gate.

Custom hooks under `hooks/` and `features/<feature>/hooks/` that carry non-trivial state or side
effects are also in this tier.

### Tier 2 - Integration tests: server actions, jobs, and IO adapters

Write integration tests against a real Postgres instance (see Tools) for every server action in
`mutations.ts`, every cron-triggered job (recurring invoice generation, overdue detection), and
every adapter that wraps an external dependency (email providers, Stripe, S3) with the SDK stubbed
at the module boundary.

### Tier 3 - E2E with Playwright: five canonical flows

Keep E2E tests short and focused on flows that cross multiple features:

1. Register → setup wizard → TOTP enrollment → recovery codes → first dashboard view.
2. Client → project → proposal → public acceptance (OTP) → convert to invoice → mark paid.
3. Time entry → conversion to invoice → send → mark paid.
4. Recurring invoice generation produces the expected draft on the configured next-run date.
5. Password reset via recovery code.

### Tier 4 - Selective component tests

Test a component only when it carries one of:

- A state machine (multi-step dialogs, wizards with branching paths).
- Conditional rendering on three or more distinct branches.
- Form submission orchestration (validation + server action call + error surfacing).
- Non-trivial keyboard or focus behavior.

When testing a component, assert visible output and user-observable behavior - never internal
callback names, render counts, or React internals. Use `@testing-library/react` and
`@testing-library/user-event`. Query priority: `getByRole` with accessible name first, then
`getByLabelText`, then `getByText`. `getByTestId` is the last resort and requires an inline comment
explaining why no semantic query could work.

### Tier 5 - Never tested

- UI primitives in `components/ui/` - trust shadcn and Radix UI.
- Server components and page files directly - covered by E2E.
- Pure presentational components with no logic.
- Drizzle queries in isolation - covered by their consumers in integration tests.
- Implementation details: private functions, internal state shape, render counts.
- Snapshot tests of rendered React - banned. Snapshots are reserved for pure-function output such as
  generated SQL strings or serialized PDF byte ranges.

## Tools

| Tool                                                     | Use                                                                         | Never use                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Vitest                                                   | Unit and integration runner                                                 | Jest                                                                          |
| `@testing-library/react` + `@testing-library/user-event` | Component tests                                                             | Enzyme                                                                        |
| `happy-dom`                                              | DOM environment for component tests (faster than jsdom)                     | Switch to jsdom only when a specific test needs DOM APIs that happy-dom lacks |
| Playwright                                               | E2E                                                                         | Cypress                                                                       |
| `vitest-axe`                                             | Accessibility assertions in component tests                                 | -                                                                             |
| `@faker-js/faker`                                        | Test data, behind factory functions                                         | Inline object literals for non-trivial entities                               |
| MSW                                                      | HTTP mocking when an external provider must be stubbed at the network layer | -                                                                             |
| Docker Compose (`docker-compose.test.yml`)               | Postgres instance for integration tests                                     | A shared, persistent database                                                 |

The integration test Postgres schema is migrated freshly per test run. Tables are truncated between
individual tests.

## File placement and structure

| Test kind                               | Location                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| Service unit tests                      | `features/<feature>/services/__tests__/<serviceName>.test.ts`    |
| Shared hook tests                       | `hooks/__tests__/useHookName.test.ts`                            |
| Feature hook tests                      | Sibling `useHookName.test.ts` next to the hook file              |
| Component tests (folder component)      | `ComponentName/__tests__/ComponentName.test.tsx`                 |
| Component tests (single-file component) | `__tests__/ComponentName.test.tsx` adjacent to the component     |
| Server action integration tests         | `features/<feature>/__tests__/<actionName>.integration.test.ts`  |
| E2E tests                               | `tests/e2e/<flow-name>.spec.ts`, one flow per file               |
| Test factories                          | `tests/factories/<entity>.ts` exporting `makeEntity(overrides?)` |

Use `test(...)` at the top level when the file has fewer than four tests. Use `describe(...)` only
to group related cases beyond that threshold.

Test names follow `<behavior> when <condition>` or the `it should <behavior> when <condition>` form.
State the behavior, never the function name.

The test body uses Arrange → Act → Assert with one blank line between each section. No comments
labeling the sections - the structure is the documentation. One assertion concept per test; multiple
`expect` calls are fine when they verify a single behavior together.

```ts
// ✓ - AAA structure, behavior-first name, no internal call assertions
test("returns zero tax when no line items are provided", () => {
  const lineItems: LineItem[] = []

  const result = calculateInvoiceTotal(lineItems)

  expect(result.subtotalCents).toBe(0)
  expect(result.taxCents).toBe(0)
  expect(result.totalCents).toBe(0)
})

// ✗ - asserts that an internal function was called; tests implementation, not behavior
test("calculateInvoiceTotal calls applyDiscount for each item", () => {
  const spy = vi.spyOn(discountModule, "applyDiscount")

  calculateInvoiceTotal(lineItems)
  expect(spy).toHaveBeenCalledTimes(lineItems.length)
})
```

```tsx
// ✓ - asserts visible output via getByRole; simulates real user interaction
test("shows a validation error when the amount is empty", async () => {
  const user = userEvent.setup()

  render(<PaymentForm onSubmit={vi.fn()} />)

  await user.click(screen.getByRole("button", { name: "Save payment" }))

  expect(screen.getByRole("alert")).toHaveTextContent("Amount is required")
})

// ✗ - inspects hook state rather than what the user sees
test("sets error state when amount is empty", () => {
  const { result } = renderHook(() => usePaymentForm())

  act(() => result.current.handleSubmit())

  expect(result.current.errors.amount).toBeDefined()
})
```

```ts
// ✓ - integration test backed by a factory; no inline object construction
test("marks an invoice as paid and returns the updated record", async () => {
  const invoice = await makeInvoice({ status: "sent" })

  const result = await markInvoicePaid({ invoiceId: invoice.id, currentStatus: invoice.status })

  expect(result).toEqual({ data: expect.objectContaining({ status: "paid" }) })
})

// ✗ - entity constructed inline; brittle if the schema adds required fields
test("marks an invoice as paid", async () => {
  const [invoice] = await database
    .insert(invoices)
    .values({
      id: "abc",
      projectId: "xyz",
      status: "sent",
      number: "INV-001",
      totalCents: 10000,
      currency: "EUR"
    })
    .returning()
  // ...
})
```

## Determinism and CI

- **No real time.** Every test that involves dates, durations, or timeouts uses `vi.useFakeTimers()`
  and `vi.setSystemTime(<fixed-date>)` in `beforeEach`, restored in `afterEach`.
- **No real network.** External SDKs are mocked at the module boundary or via MSW at the network
  layer. Tests never make real HTTP calls.
- **No test ordering.** Each test owns its setup and teardown. Integration tests truncate tables in
  `beforeEach`. No test relies on state left by a previous test.
- **No focus modifiers in committed code.** `describe.only`, `test.only`, and `.skip` must not be
  committed. CI detects and fails the build if any are found.

Expected scripts:

| Script                  | Runs                                              | Required for                         |
| ----------------------- | ------------------------------------------------- | ------------------------------------ |
| `pnpm test`             | Vitest unit suite (services + components + hooks) | Every PR                             |
| `pnpm test:integration` | Integration suite against Dockerized Postgres     | Every PR                             |
| `pnpm test:e2e`         | Playwright suite against a built image            | PRs into `master`; nightly otherwise |

Coverage is tracked for all tiers but only enforced as a hard gate for `features/*/services/`, which
must remain above 90%.
