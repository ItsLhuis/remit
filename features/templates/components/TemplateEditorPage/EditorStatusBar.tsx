"use client"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

import { BLOCK_LABEL_KEYS } from "../../labels"
import { GRID_SIZE, type Block } from "../../schemas"

type EditorStatusBarProps = {
  selectedBlock: Block | null
}

// Read-only canvas facts: block type, W x H, and the (x, y) position inside the content box. The
// grid indicator is static on purpose - snapping is mandatory and never a toggle.
const EditorStatusBar = ({ selectedBlock }: EditorStatusBarProps) => {
  const { t } = useTranslation()

  const summary = selectedBlock
    ? [
        t(BLOCK_LABEL_KEYS[selectedBlock.type]),
        t("templates.editor.statusSize", {
          width: `${selectedBlock.layout.width}px`,
          height: `${selectedBlock.layout.height}px`
        }),
        t("templates.editor.statusPosition", {
          x: selectedBlock.layout.x,
          y: selectedBlock.layout.y
        })
      ].join(" · ")
    : t("templates.editor.statusNoSelection")

  return (
    <footer className="bg-card border-border flex h-7 shrink-0 items-center justify-between border-t px-3">
      <Typography affects={["muted", "tiny"]} className="truncate tabular-nums">
        {summary}
      </Typography>
      <Typography affects={["muted", "tiny"]} className="tabular-nums">
        {t("templates.editor.gridSize", { size: GRID_SIZE })}
      </Typography>
    </footer>
  )
}

export { EditorStatusBar }
