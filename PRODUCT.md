# Product

## Register

product

## Users

Independent freelancers and solo professionals who run their own business and want to own the
software that runs it. Their context is operational, not casual: they open Remit to do real money
work, often switching between admin (settings, backups, self-hosting) and revenue work (quoting,
invoicing, chasing payment). They are not necessarily finance people, but the numbers they touch are
real and consequential.

Two secondary roles share the same instance: an **accountant** (read-only, export) and an
**assistant** (creates drafts, cannot send or delete). The owner is always the primary user; the
others are layered on without changing the single-instance model.

The job to be done: run the complete money lifecycle of a freelance business, from first contact to
paid invoice, on infrastructure the user owns, without subscriptions, lock-in, or trusting a third
party with client data.

## Product Purpose

Remit is an open-source, self-hostable business management platform for independent freelancers. It
covers the full lifecycle: Lead, Client, Project, Proposal, Contract, Time, Expenses, Invoice,
Payment, Credit Note, Reporting, and self-hosting operations. Every stage is optional; the product
adapts to the workflow the user actually has.

It exists because the alternative is SaaS: monthly fees, client data on someone else's servers, and
vendor lock-in that can change pricing or disappear. Remit inverts that. Self-hosting is the
first-class deployment model. Sensitive credentials are encrypted at rest. A managed Hosted option
runs the same code on a dedicated isolated instance per customer, never a shared multi-tenant
database.

Success looks like a freelancer trusting Remit with the data that runs their business, completing a
full quote-to-paid cycle without friction, and never feeling they need to export and leave.

## Brand Personality

Calm, precise, trustworthy.

The interface should feel like financial-grade infrastructure that happens to be pleasant: quiet
confidence, not flash. It is the opposite of a hype product. Voice is plain and direct, sentence
case, no marketing adjectives, no exclamation, no manufactured urgency. Copy states what is true and
what to do next.

Emotional goal: lower the anxiety that surrounds money and admin work. The user should feel in
control, certain the numbers are right, and certain their data is theirs. Confidence and calm are
the target feelings, never excitement or pressure.

## Anti-references

This product must not look like any of the following:

- **Generic SaaS startup landing.** No gradient blobs, no hero-metric template (big number, small
  label, gradient accent), no endless identical feature-card grids, no gradient text. The default
  AI-slop look is disqualifying here.
- **Playful consumer app.** No oversized rounded everything, no mascots, no candy-bright palettes,
  no bouncy or elastic motion. This is a tool people run a livelihood on, not a toy.
- **Crypto / neon fintech.** No neon-on-black dashboards, no glow effects, no hype aesthetic. That
  signals the wrong kind of risk for owned, private business data.
- **Legacy accounting software.** No dense gray enterprise chrome, no dated toolbars, no joyless
  2010-era tables. Functional is not an excuse for ugly or anxious.

The line to walk: serious and precise without being cold or dated, pleasant without being casual or
hyped.

## Design Principles

1. **Calm confidence over hype.** Reduce anxiety around money and admin. Surface the right number at
   the right moment; never manufacture urgency, never shout. The product earns trust by being quiet
   and correct.
2. **Precision is trust.** Money, dates, tax, and currency must read as exact and unambiguous.
   Alignment, formatting, and rounding are not cosmetic here; a sloppy figure undermines the entire
   value proposition. When in doubt, be explicit.
3. **Respect the user's actual workflow.** Every lifecycle stage is optional. The UI never forces a
   stage, never punishes skipping one, and never assumes a linear path. Meet users where their real
   process is.
4. **Single-instance simplicity, no dark patterns.** One instance is one business. No per-seat
   upsell logic, no growth-hacking nudges, no data-hostage friction. The product practices the
   ownership and privacy it preaches, including in its UX.
5. **Operations are product.** Self-hosting surfaces (system health, backups, restore, key rotation,
   settings) are designed with the same care as the invoice screen. Running your own instance should
   feel first-class, not like a sysadmin afterthought.

## Accessibility & Inclusion

Target: **WCAG 2.2 AA**, keyboard-first.

Every primary action is completable without a mouse. Color is never the sole signal; state always
pairs with an icon, label, or text. Focus is always visible. Async state changes are announced to
screen readers. Reduced-motion preferences are respected. These are enforced, not aspirational, in
[.agents/rules/accessibility.md](.agents/rules/accessibility.md), which is the canonical
accessibility contract for the codebase.
