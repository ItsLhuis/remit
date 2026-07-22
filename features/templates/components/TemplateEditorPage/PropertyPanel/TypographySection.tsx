"use client"

import { useTranslation } from "@/lib/i18n"

import { TEMPLATE_FONT_LABEL_KEYS } from "../../../labels"
import {
  TEMPLATE_FONT_KEYS,
  type Block,
  type BlockStyle,
  type StyledBlock,
  type TemplateFontKey
} from "../../../schemas"
import { patchBlockStyle, sharedValue } from "../../../services"

import { FieldRowColor } from "./FieldRowColor"
import { FieldRowNumber } from "./FieldRowNumber"
import { FieldRowSegmented } from "./FieldRowSegmented"
import { FieldRowSelect } from "./FieldRowSelect"
import { PanelSection } from "./PanelSection"

type TypographySectionProps = {
  blocks: readonly Block[]
  disabled?: boolean
  onStyleChange: (edits: ReadonlyMap<string, BlockStyle | undefined>) => void
}

const PAGE_DEFAULT_VALUE = "default"

const MIXED_VALUE = "mixed"

const FONT_WEIGHT_LABEL_KEYS = {
  "300": "templates.editor.weight300",
  "400": "templates.editor.weight400",
  "500": "templates.editor.weight500",
  "600": "templates.editor.weight600",
  "700": "templates.editor.weight700"
} as const

const FONT_WEIGHTS = ["300", "400", "500", "600", "700"] as const

// One section for single- and multi-selection: fields show the shared value or the Mixed
// placeholder, and a commit writes through to every member as a single history entry.
const TypographySection = ({ blocks, disabled, onStyleChange }: TypographySectionProps) => {
  const { t } = useTranslation()

  const anchor = blocks[0]
  const styledBlocks = blocks.filter((block): block is StyledBlock => block.type !== "group")

  const fontFamily = sharedValue(styledBlocks.map((block) => block.style?.fontFamily ?? null))
  const fontSize = sharedValue(styledBlocks.map((block) => block.style?.fontSize ?? null))
  const fontWeight = sharedValue(styledBlocks.map((block) => block.style?.fontWeight ?? null))
  const textColor = sharedValue(styledBlocks.map((block) => block.style?.textColor ?? null))
  const textAlign = sharedValue(styledBlocks.map((block) => block.style?.textAlign ?? null))
  const lineHeight = sharedValue(styledBlocks.map((block) => block.style?.lineHeight ?? null))
  const mixedLabel = t("templates.editor.mixedValue")

  const patch = (partial: Partial<BlockStyle>) => {
    onStyleChange(
      new Map(styledBlocks.map((block) => [block.id, patchBlockStyle(block.style, partial)]))
    )
  }

  if (!anchor) return null

  return (
    <PanelSection label={t("templates.editor.sectionTypography")}>
      <FieldRowSelect
        id={`${anchor.id}-font-family`}
        label={t("templates.editor.fontFamily")}
        value={fontFamily.kind === "mixed" ? MIXED_VALUE : (fontFamily.value ?? PAGE_DEFAULT_VALUE)}
        options={[
          ...(fontFamily.kind === "mixed" ? [{ value: MIXED_VALUE, label: mixedLabel }] : []),
          { value: PAGE_DEFAULT_VALUE, label: t("templates.editor.pageDefault") },
          ...TEMPLATE_FONT_KEYS.map((key) => ({
            value: key,
            label: t(TEMPLATE_FONT_LABEL_KEYS[key])
          }))
        ]}
        disabled={disabled}
        onChange={(value) => {
          if (value === MIXED_VALUE) return

          patch({
            fontFamily: value === PAGE_DEFAULT_VALUE ? undefined : (value as TemplateFontKey)
          })
        }}
      />
      <FieldRowNumber
        id={`${anchor.id}-font-size`}
        label={t("templates.editor.fontSize")}
        value={fontSize.kind === "uniform" ? fontSize.value : null}
        min={8}
        max={64}
        placeholder={fontSize.kind === "mixed" ? mixedLabel : t("templates.editor.pageDefault")}
        disabled={disabled}
        onChange={(value) => patch({ fontSize: value ?? undefined })}
      />
      <FieldRowSegmented
        label={t("templates.editor.fontWeight")}
        value={fontWeight.kind === "uniform" ? (fontWeight.value ?? undefined) : undefined}
        options={FONT_WEIGHTS.map((weight) => ({
          value: weight,
          label: t(FONT_WEIGHT_LABEL_KEYS[weight])
        }))}
        disabled={disabled}
        onChange={(value) => patch({ fontWeight: value as BlockStyle["fontWeight"] })}
      />
      <FieldRowColor
        id={`${anchor.id}-text-color`}
        label={t("templates.editor.textColor")}
        value={textColor.kind === "uniform" ? (textColor.value ?? undefined) : undefined}
        fallback="#0f172a"
        disabled={disabled}
        onChange={(value) => patch({ textColor: value })}
      />
      <FieldRowSegmented
        label={t("templates.editor.textAlign")}
        value={textAlign.kind === "uniform" ? (textAlign.value ?? undefined) : undefined}
        options={[
          { value: "left", label: t("templates.editor.alignLeft") },
          { value: "center", label: t("templates.editor.alignCenter") },
          { value: "right", label: t("templates.editor.alignRight") }
        ]}
        disabled={disabled}
        onChange={(value) => patch({ textAlign: value as BlockStyle["textAlign"] })}
      />
      <FieldRowNumber
        id={`${anchor.id}-line-height`}
        label={t("templates.editor.lineHeight")}
        value={lineHeight.kind === "uniform" ? lineHeight.value : null}
        min={1}
        max={2.5}
        step={0.1}
        placeholder={lineHeight.kind === "mixed" ? mixedLabel : t("templates.editor.pageDefault")}
        disabled={disabled}
        onChange={(value) => patch({ lineHeight: value ?? undefined })}
      />
    </PanelSection>
  )
}

export { TypographySection }
