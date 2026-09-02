# DR-0011: Projects and tasks

- **Status:** Shipped
- **Date:** 2026-07-28
- **Verdict:** Complete
- **Decisions:** ADR-0004
- **Supersedes:** —
- **Reconstructed:** yes

## What

Projects that hang off a client with status, budget and dates, and a lightweight task board with a
five-status workflow inside each project.

## Why

A project is the unit a freelancer actually bills against: it is what time is logged to, what an
expense is charged to, and what a proposal quotes for. Without it, every document would have hung
directly off a client and there would have been no way to ask what one piece of work cost. The task
board exists because the alternative — a separate project management tool — reintroduces the
fragmentation Remit exists to remove.

## Scope

Included: projects with client parentage, status transitions, budget and start/end dates; the
project workspace aggregating its documents, time, expenses and tasks; tasks with a five-status
kanban board, drag-and-drop reordering, quick add, filters and due dates.

Excluded: task dependencies, subtasks, assignees beyond the instance's own users, and time estimates
per task. The task system is deliberately lightweight — it exists to let a freelancer track their
own work, not to be a project management product. Also excluded: tasks as a document parent; they
cannot carry line items.

## How

The board's ordering is a `position` value rather than an array index, so two concurrent reorders
cannot swap into each other. The reorder write is a single `CASE` statement rather than one update
per card, because a drag across a long column is otherwise a burst of round trips.

Drag-and-drop is dnd-kit rather than native HTML5 drag events, which is what makes the board
keyboard operable — the same interaction the template editor later standardised on.

Status transitions are guarded by pure predicates (`canTransitionProjectStatus`,
`canTransitionTaskStatus`) rather than by the form, so the rule holds for any caller.

## Evidence

- `features/projects/`, `features/tasks/`
- `features/projects/services/canTransitionProjectStatus.ts`, `summarizeProjects.ts`,
  `toProjectFormData.ts`
- `features/tasks/services/canTransitionTaskStatus.ts`, `taskPosition.ts`
- `features/projects/components/ProjectWorkspace/`, `features/tasks/components/`
- `database/schema/projects.ts`, `database/schema/tasks.ts`
- `app/(dashboard)/projects/`, `app/(dashboard)/projects/[projectId]/tasks/`
- `docs/architecture/adr/0004-feature-module-structure.md`

## Verification

Service unit tests cover both transition guards and the task position arithmetic. Integration tests
cover the project and task mutations against a real Postgres, including the bulk reorder. Schema
tests pin the validation contracts.

Not covered by an automated test: the drag interaction itself. The board's keyboard and pointer
behaviour is verified by hand; the equivalent gesture machinery in the template editor is the part
that carries Playwright coverage.

## Known gaps

`task` is a permitted `entity_type` value that nothing ever writes, so tasks never appear in the
activity feed despite being able to.
