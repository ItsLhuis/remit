"use client"

import { useTranslation } from "@/lib/i18n"

import { Button, Icon } from "@/components/ui"

import { BLOCK_ICON_NAMES, BLOCK_LABEL_KEYS } from "../../../labels"
import { type Block, type BlockConstraints, type FrameContent } from "../../../schemas"
import { getFrameChildPalette, type FrameChildType } from "../../../services"

import { FieldRowSelect } from "./FieldRowSelect"
import { FieldRowSwitch } from "./FieldRowSwitch"
import { PanelSection } from "./PanelSection"

type FrameBlock = Extract<Block, { type: "frame" }>

type FrameContentSectionProps = {
  block: FrameBlock
  depth: number
  disabled?: boolean
  onChange: (block: FrameBlock) => void
  onAddChild: (frameId: string, childType: FrameChildType) => void
  onMoveChild: (childId: string, offset: -1 | 1) => void
  onRemoveChild: (id: string) => void
  onSelectChild: (id: string) => void
}

// The frame's content editor: the clip toggle plus the ordered child list. Children are
// absolutely positioned inside the frame; selecting one switches the inspector to that child, and
// the up/down controls reorder the child z-order (later renders on top). Add-child spawns a block at
// the frame origin the user then drags into place; a block can also be dragged into the frame on the
// canvas.
const FrameContentSection = ({
  block,
  depth,
  disabled,
  onChange,
  onAddChild,
  onMoveChild,
  onRemoveChild,
  onSelectChild
}: FrameContentSectionProps) => {
  const { t } = useTranslation()

  const { content } = block

  const update = (next: Partial<FrameContent>) => {
    onChange({ ...block, content: { ...content, ...next } })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <FieldRowSwitch
        id={`${block.id}-clip`}
        label={t("templates.editor.frameClip")}
        checked={content.clip}
        disabled={disabled}
        onChange={(clip) => update({ clip })}
      />
      <div className="flex flex-col gap-1">
        {content.children.map((child, index) => (
          <div
            key={child.id}
            className="group/frame-child hover:bg-muted flex items-center gap-1 rounded-md pr-1"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-w-0 flex-1 justify-start gap-1.5 hover:bg-transparent"
              onClick={() => onSelectChild(child.id)}
            >
              <Icon
                name={BLOCK_ICON_NAMES[child.type]}
                aria-hidden="true"
                className="text-muted-foreground size-3.5 shrink-0"
              />
              <span className="truncate text-xs">{t(BLOCK_LABEL_KEYS[child.type])}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || index === 0}
              aria-label={t("templates.editor.frameChildMoveUp")}
              className="opacity-0 group-hover/frame-child:opacity-100 focus-visible:opacity-100"
              onClick={() => onMoveChild(child.id, -1)}
            >
              <Icon name="ArrowUp" aria-hidden="true" className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || index === content.children.length - 1}
              aria-label={t("templates.editor.frameChildMoveDown")}
              className="opacity-0 group-hover/frame-child:opacity-100 focus-visible:opacity-100"
              onClick={() => onMoveChild(child.id, 1)}
            >
              <Icon name="ArrowDown" aria-hidden="true" className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={t("templates.editor.removeBlock")}
              className="text-muted-foreground hover:text-destructive opacity-0 group-hover/frame-child:opacity-100 focus-visible:opacity-100"
              onClick={() => onRemoveChild(child.id)}
            >
              <Icon name="Trash2" aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-1.5">
          {getFrameChildPalette(depth).map((childType) => (
            <Button
              key={childType}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onAddChild(block.id, childType)}
            >
              <Icon name={BLOCK_ICON_NAMES[childType]} aria-hidden="true" />
              {t(BLOCK_LABEL_KEYS[childType])}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

export { FrameContentSection }

// A child block absent constraints pins top-left (services/constraints.ts's applyFrameResize
// default), so the selects show that as their resolved value rather than leaving the control blank.
const DEFAULT_CONSTRAINTS: BlockConstraints = { horizontal: "start", vertical: "start" }

const CONSTRAINT_AXIS_OPTIONS = ["start", "end", "center", "stretch", "scale"] as const

const CONSTRAINT_AXIS_LABEL_KEYS = {
  start: "templates.editor.constraintStart",
  end: "templates.editor.constraintEnd",
  center: "templates.editor.constraintCenter",
  stretch: "templates.editor.constraintStretch",
  scale: "templates.editor.constraintScale"
} as const satisfies Record<(typeof CONSTRAINT_AXIS_OPTIONS)[number], string>

type FrameChildConstraintsSectionProps = {
  block: Block
  disabled?: boolean
  onChange: (id: string, constraints: BlockConstraints) => void
}

// Per-axis layout constraints for a frame's direct child: read by applyFrameResize when the parent
// frame's own box resizes. Rendered on the child's own inspector (only reachable while a frame's
// direct child is selected), not the frame's own panel.
const FrameChildConstraintsSection = ({
  block,
  disabled,
  onChange
}: FrameChildConstraintsSectionProps) => {
  const { t } = useTranslation()

  const constraints = block.constraints ?? DEFAULT_CONSTRAINTS

  const axisOptions = CONSTRAINT_AXIS_OPTIONS.map((axis) => ({
    value: axis,
    label: t(CONSTRAINT_AXIS_LABEL_KEYS[axis])
  }))

  return (
    <PanelSection label={t("templates.editor.sectionConstraints")}>
      <FieldRowSelect
        id={`${block.id}-constraint-horizontal`}
        label={t("templates.editor.constraintHorizontal")}
        value={constraints.horizontal}
        options={axisOptions}
        disabled={disabled}
        onChange={(horizontal) =>
          onChange(block.id, {
            ...constraints,
            horizontal: horizontal as BlockConstraints["horizontal"]
          })
        }
      />
      <FieldRowSelect
        id={`${block.id}-constraint-vertical`}
        label={t("templates.editor.constraintVertical")}
        value={constraints.vertical}
        options={axisOptions}
        disabled={disabled}
        onChange={(vertical) =>
          onChange(block.id, { ...constraints, vertical: vertical as BlockConstraints["vertical"] })
        }
      />
    </PanelSection>
  )
}

export { FrameChildConstraintsSection }
