export type RestoreParent = {
  // Already translated by the caller, because a service may not reach the i18n runtime and every
  // feature names its own parents. Passing the label rather than an entity kind is what keeps this
  // function free of a switch that would have to grow with every new restorable entity.
  label: string
  deletedAt: Date | null
}

// A restore is refused while any parent of the row is still deleted. Soft delete does not cascade
// in Remit — `softDeleteClient` stamps the client and nothing else — so a deleted parent beneath a
// live child is a state the product never produces on its own, and letting a restore create one
// would defeat the composite parent keys of ADR-0026 from the application side.
export function resolveRestoreBlocker(parents: ReadonlyArray<RestoreParent>): string | null {
  return parents.find((parent) => parent.deletedAt !== null)?.label ?? null
}
