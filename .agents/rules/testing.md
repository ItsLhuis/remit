# Testing Rules

## What we test

Tests catch regressions in user-observable behaviour; they never chase a coverage number. Every test
justifies itself by describing a behaviour.

### Tier 1 - High coverage (>90%): services, shared utilities, and non-trivial hooks

`features/<feature>/services/` holds the pure business logic (tax, status transition guards, invoice
numbering, retainer pools, next-run dates). Coverage above 90% is a hard CI gate. Shared utilities
under `lib/utils/` with branches, parsing, fallbacks or edge cases are unit-tested too: request
metadata helpers such as `getIpAddress(headers)` cover forwarded headers, fallback headers, empty
values and missing values. Hooks under `hooks/` and `features/<feature>/hooks/` with non-trivial
state or side effects are in this tier.

### Tier 2 - Integration tests: server actions, jobs, and IO adapters

Integration tests against real Postgres cover every server action in `mutations.ts`, every
cron-triggered job (recurring generation, overdue detection) and every adapter wrapping an external
dependency (email, Stripe, S3) with the SDK stubbed at the module boundary. Assert the
user-observable result and important persisted side effects; for audit-sensitive actions assert that
audit metadata is populated through the shared helper path.

### Tier 3 - E2E with Playwright: five canonical flows

Keep E2E tests short and focused on flows that cross features:

1. Register -> setup wizard -> TOTP enrollment -> recovery codes -> first dashboard view.
   `tests/e2e/auth.spec.ts` drives it to the QR step; the recovery-code screen is not asserted.
2. Client -> project -> proposal -> public acceptance (OTP) -> convert to invoice -> mark paid.
   `tests/e2e/proposalToPaid.spec.ts`.
3. Time entry -> conversion to invoice -> send -> mark paid. `tests/e2e/timeToInvoice.spec.ts`.
4. Recurring invoice generation produces the expected draft on the configured next-run date.
   `tests/e2e/recurringGeneration.spec.ts`.
5. Password reset, and the second factor still demanded afterwards.
   `lib/auth/__tests__/passwordReset.integration.test.ts`.

Flow 5 is deliberately not a Playwright spec: Remit has exactly one user by construction, so a
browser-driven reset would change the credential every other spec authenticates as — on a
self-hosted instance, somebody's real account with no way back. The integration suite creates the
account it resets. A flow on this list is a claim about coverage, not about which runner provides
it.

### Tier 4 - Selective component tests

Test a component only when it carries a state machine (multi-step dialogs, branching wizards),
conditional rendering on three or more branches, form submission orchestration (validation + action
call + error surfacing), or non-trivial keyboard or focus behaviour. Assert visible output and
user-observable behaviour, never callback names, render counts or React internals. Use
`@testing-library/react` and `@testing-library/user-event`; query by `getByRole` with accessible
name, then `getByLabelText`, then `getByText`. `getByTestId` is the last resort and needs an inline
comment explaining why no semantic query works.

### Tier 5 - Never tested

- UI primitives in `components/ui/` (trust shadcn and Radix).
- Server components and page files directly (covered by E2E).
- Pure presentational components with no logic.
- Drizzle queries in isolation (covered by integration tests of their consumers).
- Implementation details: private functions, internal state shape, render counts.
- Snapshot tests of rendered React. Snapshots are only for pure-function output such as generated
  SQL strings or serialized PDF byte ranges.

## Tools

| Tool                                                     | Use                                                      | Never use                                  |
| -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| Vitest                                                   | Unit and integration runner                              | Jest                                       |
| `@testing-library/react` + `@testing-library/user-event` | Component tests                                          | Enzyme                                     |
| `happy-dom`                                              | DOM environment (faster than jsdom)                      | jsdom, unless a test needs an API it lacks |
| Playwright                                               | E2E                                                      | Cypress                                    |
| `vitest-axe`                                             | Accessibility assertions in component tests              | -                                          |
| `@faker-js/faker`                                        | Test data, behind factory functions                      | Inline literals for non-trivial entities   |
| MSW                                                      | HTTP mocking when a provider must be stubbed on the wire | -                                          |
| Docker Compose (`docker-compose.test.yml`)               | Postgres for integration tests                           | A shared, persistent database              |

The integration schema is migrated freshly per run; tables are truncated between tests.

## File placement and structure

| Test kind                               | Location                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| Service unit tests                      | `features/<feature>/services/__tests__/<serviceName>.test.ts`    |
| Shared utility unit tests               | `lib/utils/__tests__/<utilityName>.test.ts`                      |
| Shared hook tests                       | `hooks/__tests__/<useHookName>.test.ts`                          |
| Feature hook tests                      | Sibling `useHookName.test.ts` next to the hook file              |
| Component tests (folder component)      | `ComponentName/__tests__/ComponentName.test.tsx`                 |
| Component tests (single-file component) | `__tests__/ComponentName.test.tsx` adjacent to the component     |
| Server action integration tests         | `features/<feature>/__tests__/<actionName>.integration.test.ts`  |
| E2E tests                               | `tests/e2e/<flow-name>.spec.ts`, one flow per file               |
| Host-side script tests                  | `scripts/host/__tests__/<scriptName>.test.ts`                    |
| Test factories                          | `tests/factories/<entity>.ts` exporting `makeEntity(overrides?)` |
| Docs consistency tests                  | `tests/docs/*.test.ts`                                           |

- Use top-level `test(...)` when a file has fewer than four tests; `describe(...)` only to group
  beyond that.
- Names follow `<behavior> when <condition>` or `it should <behavior> when <condition>`; state the
  behaviour, never the function name.
- Bodies are Arrange → Act → Assert with one blank line between sections and no section-label
  comments. One assertion concept per test; several `expect` calls are fine when they verify one
  behaviour together.
- Never assert that an internal function was called (`vi.spyOn(...)` on a collaborator to count
  calls tests implementation, not behaviour). Never inspect hook state when the behaviour is visible
  in the rendered output.
- Integration tests build entities with factories (`await makeInvoice({ status: "sent" })`), never
  inline `database.insert(...)` literals that break when the schema adds a required field.

## Determinism and CI

- **No real time.** Tests involving dates, durations or timeouts use `vi.useFakeTimers()` and
  `vi.setSystemTime(<fixed-date>)` in `beforeEach`, restored in `afterEach`.
- **No real network.** External SDKs are mocked at the module boundary or via MSW.
- **No test ordering.** Each test owns its setup and teardown; integration tests truncate tables in
  `beforeEach`.
- **No focus modifiers.** `.only` and `.skip` are never committed (lint-enforced for Vitest files by
  `no-restricted-syntax`; Playwright specs may use `test.skip` for conditional skips).
- **A test never seen failing is not evidence.** When a test guards a fix or a contract, see it fail
  without the change before trusting it.

| Script                  | Runs                                              | Required for                       |
| ----------------------- | ------------------------------------------------- | ---------------------------------- |
| `pnpm test`             | Vitest unit suite (services + components + hooks) | Every PR                           |
| `pnpm test:integration` | Integration suite against Dockerized Postgres     | Every PR                           |
| `pnpm test:e2e`         | Playwright suite against a built image            | PRs into `main`; nightly otherwise |

Coverage is tracked for all tiers but enforced as a hard gate only for `features/*/services/`, which
must stay above 90%.
