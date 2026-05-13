# ADR-0006: Typed in-process event bus for cross-feature effects

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: Event bus](../ARCHITECTURE.md#8-event-bus) describes cross-feature side effects such
as marking an invoice paid, writing an activity log, writing an audit entry, invalidating dashboard
caches, sending payment receipts, and updating project status. Directly invoking every reaction from
the originating action would violate closed feature boundaries.

`lib/events` provides a central `EventMap`, typed `emit`, and typed `on`. Handlers are registered by
features, and `emit` awaits handlers in series.

Remit is structurally single-instance. There is no requirement today for a distributed event broker,
multi-process worker fleet, or durable queue for application-level side effects.

## Decision

Cross-feature side effects use a typed in-process event bus. Features emit domain events once and
own their own handlers in feature-local event modules.

## Consequences

### Positive

- Originating actions stay thin and do not import every feature that reacts to an event.
- Event names and payloads are type-checked through one shared `EventMap`.

### Negative

- Handlers run synchronously in process, so slow handlers add latency to the user action.
- Events are not durable; a process crash during emission does not replay missed handlers.

## Alternatives considered

### Direct function calls

Actions could call every required side effect directly. This was rejected because each new consumer
would reopen the original feature and increase cross-feature coupling.

### External queue or message broker

A broker would provide durability and background processing. It was rejected for now because Remit's
single-instance deployment does not justify the operational burden until recurring jobs or email
volume demand it.
