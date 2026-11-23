import { getJobHandler, getRegisteredJobNames, JOB_NAMES } from "@remit/web/lib/jobs"

import { expect, test } from "vitest"

import { loadWorkerFeatureModules } from "../loadWorkerFeatureModules"

// The drift guard between producers and the job worker. A producer only has to satisfy the
// compiler, which checks the name against `JobMap` and never against the registry, so a job name can
// be declared, fired from a mutation, and reach a worker that has no handler for it — where
// `processJob` throws, burns five attempts, and dies in a process nobody is watching. A test that
// stubs the queue never notices.
//
// An integration test rather than a unit one because it loads the real feature modules, which reach
// the web database client and `lib/config/env.ts`. It deliberately does not stub
// `@remit/web/lib/jobs`: the registry under test is the one the worker uses, and the modules are
// loaded through the same function `worker.ts` calls, so a job module added to the worker is
// covered here without anyone remembering to add it twice.
// Loaded while the file is collected rather than inside a hook: it imports every feature job module
// in one go — the whole document-rendering graph, sanitizer and template renderer included — which
// is the worker's real startup cost, and under a full-suite run it outlasts any fixed hook budget.
await loadWorkerFeatureModules()

test("registers a handler for every job name in the catalog", () => {
  const unhandled = JOB_NAMES.filter((name) => getJobHandler(name) === undefined)

  expect(unhandled).toEqual([])
})

// The other direction: a handler registered under a name the catalog no longer declares is a job
// nothing can ever enqueue. `registerJobHandler` already throws on a double registration, so
// "exactly one handler per name" needs no assertion of its own.
test("registers no handler outside the catalog", () => {
  const unknown = getRegisteredJobNames().filter((name) => !JOB_NAMES.includes(name))

  expect(unknown).toEqual([])
})
