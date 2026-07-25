export {
  ancestorChainOf,
  buildIndex,
  collectResizeMemberIds,
  descendInto,
  enclosingFrameRect,
  topLevelAncestorOf,
  toTree,
  updateRects,
  type BlockIndex,
  type BlockIndexEntry
} from "./blockIndex"

export { patchBlockStyle } from "./blockStyle"

export {
  applyStyleToBlock,
  extractStyle,
  materializePastedBlocks,
  serializeSelection
} from "./clipboard"

export {
  findBlock,
  moveSiblingGroupToEdge,
  moveSiblingOrder,
  removeById,
  replaceById,
  spliceById,
  stripName,
  stripStyle,
  type BlockLookup,
  type ContainerBlock,
  type SiblingEdge,
  type SiblingStep
} from "./blockTree"

export {
  addBlock,
  addShape,
  containerNestingDepth,
  createBlock,
  createFrameChild,
  duplicateBlock,
  flattenBlocks,
  getBlockPalette,
  getFrameChildPalette,
  reassignIds,
  BLOCK_PROPERTY_GROUPS,
  type BlockInsertion,
  type FrameChildType,
  type PropertyGroupKey
} from "./blocks"

export { evaluateFieldExpression } from "./expression"

export { normalizeBlocks } from "./normalizeBlocks"

export { applyFrameResize, resolveResizedBlocks } from "./constraints"

export {
  clampMoveRect,
  clampRectToBounds,
  clampResizeRectToBounds,
  contentMinHeight,
  findFreePosition,
  getContentBounds,
  getMinPageHeight,
  getPageHeight,
  getPageWidth,
  normalizePageSettings,
  overlaps,
  quantizeToGrid,
  reflowToBounds,
  resolveResize,
  validateLayout,
  DEFAULT_PAGE_SETTINGS,
  DOCUMENT_MIN_PAGE_HEIGHT,
  DOCUMENT_PAGE_WIDTH,
  EMAIL_MIN_PAGE_HEIGHT,
  EMAIL_PAGE_WIDTH,
  type CanvasValidation,
  type CanvasValidationReason,
  type ContentBounds,
  type Rect,
  type ResizeClampLimits,
  type ResizeEdges,
  type ResizeLimit,
  type ResizeLimits,
  type ResolvedResize,
  type Size
} from "./canvasLayout"

export {
  clampRectPositionToBounds,
  clampRotatedRectPositionToBounds,
  fitRotatedRectWithinBounds,
  floorRotatedRectAtOrigin,
  normalizeDegrees,
  pointInRect,
  pointInRotatedRect,
  rectsIntersect,
  rectsIntersectRotated,
  rotatedAabb,
  rotatePoint,
  shiftSpanIntoRange,
  translateRect,
  unionRects,
  type Point
} from "./geometry"

export {
  deriveContainerRebase,
  deriveGroupLayout,
  normalizeGroups,
  rectFromPoints,
  type ContainerRebase
} from "./groupBounds"

export {
  blocksInMarquee,
  deepestAt,
  hitTestBlocks,
  topLevelAncestorAt,
  type HitTestOptions,
  type MarqueeOptions
} from "./hitTest"

export { resolveMovedBlocks } from "./moveMath"

export {
  buildSampleRenderData,
  extractMergeTokens,
  findUnknownTokens,
  getMergeVariables,
  ALL_MERGE_VARIABLES,
  MERGE_TOKEN_SOURCE,
  MERGE_VARIABLES,
  type LineItemRenderRow,
  type MergeVariableId,
  type TemplateRenderData
} from "./mergeVariables"

export { renderBlockContent, renderTemplate, BUSINESS_LOGO_ASSET_KEY } from "./renderTemplate"

export { reparentBlock, type ReparentResult } from "./reparent"

export {
  collectRotationMembers,
  foldRotation,
  quantizeDegrees,
  resolveBlocksRotationTo,
  resolveRotatedBlocks,
  rotateSetBy,
  rotateSetTo,
  type RotatedMember,
  type RotationMember,
  type RotationSet
} from "./rotateMath"

export {
  anchorResizedRect,
  anchorResizedRectRotated,
  clampSetScaleFactors,
  isUniformOnly,
  resolveHandleResize,
  scaleBlockSet,
  type HandleDirection,
  type ResizeSetMember,
  type ResolveHandleResizeInput
} from "./resizeMath"

export {
  sanitizeTemplateHtml,
  toPlainText,
  unwrapSanitizedHtml,
  type SanitizedHtml
} from "./sanitizeHtml"

export {
  cursorForHandle,
  handlePositions,
  moveGuides,
  selectionBounds,
  ALL_HANDLE_DIRECTIONS,
  type GuideLine
} from "./selectionGeometry"

export { intersectPropertyGroups, sharedValue, type SharedFieldValue } from "./sharedValue"

export {
  summarizeTemplates,
  type TemplateSummaryRow,
  type TemplatesSummary
} from "./summarizeTemplates"

export { blockStyleToCss, pageStyleToCss, TEMPLATE_FONT_STACKS } from "./styleCss"

export {
  getTemplateCategory,
  supportsLineItems,
  TEMPLATE_CATEGORIES,
  type TemplateCategory
} from "./templateCategories"
