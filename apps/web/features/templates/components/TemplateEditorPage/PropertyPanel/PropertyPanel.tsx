"use client"

import { useTranslation } from "@/lib/i18n"

import { Button, Icon, ScrollArea, Typography } from "@/components/ui"

import { type TemplateEditorState } from "../../../hooks"
import { BLOCK_ICON_NAMES, BLOCK_LABEL_KEYS } from "../../../labels"
import { type Block, type TemplateType } from "../../../schemas"
import {
  intersectPropertyGroups,
  selectionBounds,
  BLOCK_PROPERTY_GROUPS,
  type PropertyGroupKey
} from "../../../services"

import { AppearanceSection } from "./AppearanceSection"
import { BlockContentSection } from "./BlockContentSection"
import { FrameChildConstraintsSection } from "./FrameContentSection"
import { LayoutSection } from "./LayoutSection"
import { MultiLayoutSection } from "./MultiLayoutSection"
import { PageSettingsSection } from "./PageSettingsSection"
import { SpacingSection } from "./SpacingSection"
import { TypographySection } from "./TypographySection"

type PropertyPanelProps = {
  editor: TemplateEditorState
  type: TemplateType
  assets: Record<string, string>
  isEmail: boolean
  subject: string
  disabled?: boolean
  onSubjectChange: (subject: string) => void
}

type MultiSelectionPanelProps = {
  editor: TemplateEditorState
  selectedBlocks: Block[]
  disabled?: boolean
}

// The multi-selection inspector: the union layout plus the intersection of every member's property
// groups. Split out of PropertyPanel so its own branching stays off the single-selection render.
const MultiSelectionPanel = ({ editor, selectedBlocks, disabled }: MultiSelectionPanelProps) => {
  const { t } = useTranslation()

  const union = selectionBounds(editor.blockIndex, editor.selectedIds)
  const rotations = selectedBlocks.map((selected) =>
    selected.type === "group" ? 0 : (selected.rotation ?? 0)
  )
  const sharedRotation = rotations.every((value) => value === rotations[0])
    ? (rotations[0] ?? 0)
    : null
  const groups = intersectPropertyGroups(selectedBlocks.map((selected) => selected.type))
  const sectionsDisabled = disabled || selectedBlocks.some((selected) => selected.locked)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Icon name="Layers" aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        <Typography affects="medium" className="truncate">
          {t("templates.editor.multiSelectionTitle", { count: selectedBlocks.length })}
        </Typography>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {union ? (
          <MultiLayoutSection
            union={union}
            bounds={editor.bounds}
            rotation={sharedRotation}
            disabled={sectionsDisabled}
            onMove={(position) =>
              editor.moveBlocks(
                editor.selectedIds,
                { x: position.x - union.x, y: position.y - union.y },
                `layout:${editor.selectedIds.join("+")}`
              )
            }
            onResize={(size) =>
              editor.resizeBlocks(
                editor.selectedIds,
                {
                  x: union.x,
                  y: union.y,
                  width: size.width ?? union.width,
                  height: size.height ?? union.height
                },
                `layout:${editor.selectedIds.join("+")}`
              )
            }
            onRotate={(degrees) =>
              editor.rotateBlocksTo(
                editor.selectedIds,
                degrees,
                `layout:${editor.selectedIds.join("+")}`
              )
            }
          />
        ) : null}
        {groups.includes("spacing") ? (
          <SpacingSection
            blocks={selectedBlocks}
            disabled={sectionsDisabled}
            onStyleChange={editor.setBlocksStyle}
          />
        ) : null}
        {groups.includes("appearance") ? (
          <AppearanceSection
            blocks={selectedBlocks}
            disabled={sectionsDisabled}
            onStyleChange={editor.setBlocksStyle}
          />
        ) : null}
        {groups.includes("typography") ? (
          <TypographySection
            blocks={selectedBlocks}
            disabled={sectionsDisabled}
            onStyleChange={editor.setBlocksStyle}
          />
        ) : null}
      </ScrollArea>
    </div>
  )
}

// The inspector renders its style sections from the capability registry
// (BLOCK_PROPERTY_GROUPS[type]), never per-block-type copies: adding a property group to a block
// type is one registry entry, and the section components are shared across every type. A
// multi-selection renders the union layout plus the intersection of every member's property
// groups; each style field shows the shared value or a Mixed state and writes through to all
// members as one undo entry. The header (block identity + remove) stays fixed while the sections
// scroll, mirroring the left panel.
const PropertyPanel = ({
  editor,
  type,
  assets,
  isEmail,
  subject,
  disabled,
  onSubjectChange
}: PropertyPanelProps) => {
  const { t } = useTranslation()

  const block = editor.selectedBlock

  const selectedBlocks = editor.selectedIds
    .map((id) => editor.blockIndex.get(id)?.block)
    .filter((selected) => selected !== undefined)

  if (selectedBlocks.length > 1) {
    return (
      <MultiSelectionPanel editor={editor} selectedBlocks={selectedBlocks} disabled={disabled} />
    )
  }

  if (!block) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <Typography affects="medium">{t("templates.pageSettings.title")}</Typography>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <PageSettingsSection
            pageSettings={editor.pageSettings}
            isEmail={isEmail}
            subject={subject}
            disabled={disabled}
            onPageSettingsChange={editor.setPageSettings}
            onSubjectChange={onSubjectChange}
          />
        </ScrollArea>
      </div>
    )
  }

  const groups: readonly PropertyGroupKey[] = BLOCK_PROPERTY_GROUPS[block.type]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            name={BLOCK_ICON_NAMES[block.type]}
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
          />
          <Typography affects="medium" className="truncate">
            {t(BLOCK_LABEL_KEYS[block.type])}
          </Typography>
          {block.locked ? (
            <Icon
              name="Lock"
              aria-hidden="true"
              className="text-muted-foreground size-3 shrink-0"
            />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {block.type === "group" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || block.locked}
              aria-label={t("templates.editor.ungroup")}
              onClick={() => editor.ungroup(block.id)}
            >
              <Icon name="Ungroup" aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={t("templates.editor.removeBlock")}
            onClick={() => editor.removeBlock(block.id)}
          >
            <Icon name="Trash2" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <LayoutSection
          block={block}
          isChild={editor.selectedParent !== null}
          bounds={editor.bounds}
          disabled={disabled}
          onMove={editor.moveBlockTo}
          onResize={editor.resizeBlockTo}
          onRotate={(id, degrees, tag) => editor.rotateBlocksTo([id], degrees, tag ?? null)}
        />
        {editor.selectedParent?.type === "frame" ? (
          <FrameChildConstraintsSection
            block={block}
            disabled={disabled || block.locked}
            onChange={editor.setConstraints}
          />
        ) : null}
        {block.type === "group" ? null : (
          <BlockContentSection
            block={block}
            depth={editor.selectedParent ? 2 : 1}
            type={type}
            assets={assets}
            disabled={disabled || block.locked}
            onChangeBlock={(next, coalesceTag) => editor.replaceBlock(next, coalesceTag ?? null)}
            onTextContentChange={editor.setTextContent}
            onAssetUploaded={editor.registerAsset}
            onAddChild={editor.addFrameChild}
            onMoveChild={editor.moveFrameChild}
            onRemoveChild={editor.removeBlock}
            onSelectChild={editor.selectBlock}
          />
        )}
        {groups.includes("spacing") ? (
          <SpacingSection
            blocks={[block]}
            disabled={disabled || block.locked}
            onStyleChange={editor.setBlocksStyle}
          />
        ) : null}
        {groups.includes("appearance") ? (
          <AppearanceSection
            blocks={[block]}
            disabled={disabled || block.locked}
            onStyleChange={editor.setBlocksStyle}
          />
        ) : null}
        {groups.includes("typography") ? (
          <TypographySection
            blocks={[block]}
            disabled={disabled || block.locked}
            onStyleChange={editor.setBlocksStyle}
          />
        ) : null}
      </ScrollArea>
    </div>
  )
}

export { PropertyPanel }
