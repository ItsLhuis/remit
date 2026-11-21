"use client"

import { useTranslation } from "@/lib/i18n"

import {
  GRID_SIZE,
  PAGE_MARGIN_MAX,
  type Block,
  type BlockStyle,
  type StyledBlock
} from "../../../schemas"
import { patchBlockStyle, sharedValue } from "../../../services"

import { FieldRowNumber } from "./FieldRowNumber"
import { PanelSection } from "./PanelSection"

type SpacingSectionProps = {
  blocks: readonly Block[]
  disabled?: boolean
  onStyleChange: (edits: ReadonlyMap<string, BlockStyle | undefined>) => void
}

type PaddingSide = "top" | "right" | "bottom" | "left"

const SIDES: {
  side: PaddingSide
  labelKey: `templates.editor.padding${Capitalize<PaddingSide>}`
}[] = [
  { side: "top", labelKey: "templates.editor.paddingTop" },
  { side: "right", labelKey: "templates.editor.paddingRight" },
  { side: "bottom", labelKey: "templates.editor.paddingBottom" },
  { side: "left", labelKey: "templates.editor.paddingLeft" }
]

function uniformPaddingOf(block: StyledBlock): number | null {
  const padding = block.style?.padding

  return padding &&
    padding.top === padding.right &&
    padding.top === padding.bottom &&
    padding.top === padding.left
    ? padding.top
    : null
}

// One section for single- and multi-selection: each field shows the shared value when every
// selected block agrees and the Mixed placeholder otherwise, and a commit writes through to every
// member (merging per member, so setting one side never clobbers another member's other sides)
// as a single history entry.
const SpacingSection = ({ blocks, disabled, onStyleChange }: SpacingSectionProps) => {
  const { t } = useTranslation()

  const anchor = blocks[0]
  const styledBlocks = blocks.filter((block): block is StyledBlock => block.type !== "group")

  const uniform = sharedValue(styledBlocks.map(uniformPaddingOf))
  const mixedLabel = t("templates.editor.mixedValue")

  const setAll = (value: number | null) => {
    onStyleChange(
      new Map(
        styledBlocks.map((block) => [
          block.id,
          patchBlockStyle(block.style, {
            padding:
              value === null ? undefined : { top: value, right: value, bottom: value, left: value }
          })
        ])
      )
    )
  }

  const setSide = (side: PaddingSide, value: number | null) => {
    onStyleChange(
      new Map(
        styledBlocks.map((block) => {
          const base = block.style?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 }

          return [
            block.id,
            patchBlockStyle(block.style, { padding: { ...base, [side]: value ?? 0 } })
          ]
        })
      )
    )
  }

  if (!anchor) return null

  return (
    <PanelSection label={t("templates.editor.sectionSpacing")}>
      <FieldRowNumber
        id={`${anchor.id}-padding-all`}
        label={t("templates.editor.paddingAll")}
        value={uniform.kind === "uniform" ? uniform.value : null}
        min={0}
        max={PAGE_MARGIN_MAX}
        step={GRID_SIZE}
        placeholder={uniform.kind === "mixed" ? mixedLabel : "0"}
        disabled={disabled}
        onChange={setAll}
      />
      {SIDES.map(({ side, labelKey }) => {
        const shared = sharedValue(
          styledBlocks.map((block) => block.style?.padding?.[side] ?? null)
        )

        return (
          <FieldRowNumber
            key={side}
            id={`${anchor.id}-padding-${side}`}
            label={t(labelKey)}
            value={shared.kind === "uniform" ? shared.value : null}
            min={0}
            max={PAGE_MARGIN_MAX}
            step={GRID_SIZE}
            placeholder={shared.kind === "mixed" ? mixedLabel : "0"}
            disabled={disabled}
            onChange={(value) => setSide(side, value)}
          />
        )
      })}
    </PanelSection>
  )
}

export { SpacingSection }
