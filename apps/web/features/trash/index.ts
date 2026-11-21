// Client-safe and deliberately thin: it exports the pure services, the schemas and the read-model
// types, and nothing that reaches a feature. Feature mutations import `resolveRestoreBlocker` from
// here, while `server.ts` imports fifteen feature barrels to dispatch a restore — keeping the two
// surfaces apart is what stops that from being an import cycle.
export * from "./services"

export {
  restoreTrashedRecordSchema,
  TRASH_ENTITY_KINDS,
  type RestoreTrashedRecordValues,
  type TrashEntityKind
} from "./schemas"

export { type TrashItem, type TrashSectionData } from "./types"
