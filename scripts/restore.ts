import { loadCliEnvironment } from "./core/cli/bootstrap"

import { isDirectRun } from "./core/cli/isDirectRun"

import { runRestore } from "./core/restore/runRestore"

export { runRestore }

if (isDirectRun(import.meta.url)) {
  loadCliEnvironment()

  runRestore()
}
