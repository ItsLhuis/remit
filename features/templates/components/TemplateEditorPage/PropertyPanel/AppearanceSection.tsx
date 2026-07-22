"use client"

import { useTranslation } from "@/lib/i18n"

import { type Block, type BlockStyle, type StyledBlock } from "../../../schemas"
import { patchBlockStyle, sharedValue } from "../../../services"

import { FieldRowColor } from "./FieldRowColor"
import { FieldRowNumber } from "./FieldRowNumber"
import { FieldRowSegmented } from "./FieldRowSegmented"
import { PanelSection } from "./PanelSection"

type AppearanceSectionProps = {
  blocks: readonly Block[]
  disabled?: boolean
  onStyleChange: (edits: ReadonlyMap<string, BlockStyle | undefined>) => void
}

// Flat-by-default: background is none-or-solid and borders are always solid hairlines (width 0 =
// none) - the mockup's gradient, opacity, and shadow controls do not survive DESIGN.md scrutiny
// on a printable document surface. One section for single- and multi-selection: fields show the
// shared value or the Mixed placeholder, and a commit writes through to every member as a single
// history entry.
const AppearanceSection = ({ blocks, disabled, onStyleChange }: AppearanceSectionProps) => {
  const { t } = useTranslation()

  const anchor = blocks[0]
  const styledBlocks = blocks.filter((block): block is StyledBlock => block.type !== "group")

  const background = sharedValue(styledBlocks.map((block) => block.style?.backgroundColor ?? null))
  const borderWidth = sharedValue(styledBlocks.map((block) => block.style?.borderWidth ?? null))
  const borderColor = sharedValue(styledBlocks.map((block) => block.style?.borderColor ?? null))
  const borderRadius = sharedValue(styledBlocks.map((block) => block.style?.borderRadius ?? null))
  const mixedLabel = t("templates.editor.mixedValue")

  const patch = (partial: Partial<BlockStyle>) => {
    onStyleChange(
      new Map(styledBlocks.map((block) => [block.id, patchBlockStyle(block.style, partial)]))
    )
  }

  if (!anchor) return null

  return (
    <PanelSection label={t("templates.editor.sectionAppearance")}>
      <FieldRowSegmented
        label={t("templates.editor.backgroundColor")}
        value={
          background.kind === "mixed" ? undefined : background.value !== null ? "solid" : "none"
        }
        options={[
          { value: "none", label: t("templates.editor.backgroundNone") },
          { value: "solid", label: t("templates.editor.backgroundSolid") }
        ]}
        disabled={disabled}
        onChange={(value) => patch({ backgroundColor: value === "solid" ? "#ffffff" : undefined })}
      />
      {background.kind === "uniform" && background.value !== null ? (
        <FieldRowColor
          id={`${anchor.id}-background`}
          label={t("templates.editor.backgroundColor")}
          value={background.value}
          fallback="#ffffff"
          disabled={disabled}
          onChange={(value) => patch({ backgroundColor: value })}
        />
      ) : null}
      <FieldRowNumber
        id={`${anchor.id}-border-width`}
        label={t("templates.editor.borderWidth")}
        value={borderWidth.kind === "uniform" ? borderWidth.value : null}
        min={0}
        max={8}
        placeholder={borderWidth.kind === "mixed" ? mixedLabel : "0"}
        disabled={disabled}
        onChange={(value) => patch({ borderWidth: value ?? undefined })}
      />
      {borderWidth.kind === "uniform" && borderWidth.value !== null && borderWidth.value > 0 ? (
        <FieldRowColor
          id={`${anchor.id}-border-color`}
          label={t("templates.editor.borderColor")}
          value={borderColor.kind === "uniform" ? (borderColor.value ?? undefined) : undefined}
          fallback="#e2e8f0"
          disabled={disabled}
          onChange={(value) => patch({ borderColor: value })}
        />
      ) : null}
      <FieldRowNumber
        id={`${anchor.id}-border-radius`}
        label={t("templates.editor.borderRadius")}
        value={borderRadius.kind === "uniform" ? borderRadius.value : null}
        min={0}
        max={32}
        placeholder={borderRadius.kind === "mixed" ? mixedLabel : "0"}
        disabled={disabled}
        onChange={(value) => patch({ borderRadius: value ?? undefined })}
      />
    </PanelSection>
  )
}

export { AppearanceSection }
