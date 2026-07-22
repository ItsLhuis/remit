"use client"

import { useTranslation } from "@/lib/i18n"

import { ScrollArea, Typography } from "@/components/ui"

import { type EditorInteraction, type TemplateEditorState } from "../../hooks"

import { LayersList } from "./LayersList"

type EditorLeftPanelProps = {
  editor: TemplateEditorState
  interaction: EditorInteraction
  disabled?: boolean
}

// The left rail is the Layers tree only: insertion moved to the floating toolbar's insert menu, so
// this panel is dedicated to navigating and ordering the page's blocks (Page root plus every block
// top-of-stack first, frame children indented).
const EditorLeftPanel = ({ editor, interaction, disabled }: EditorLeftPanelProps) => {
  const { t } = useTranslation()

  return (
    <aside className="bg-card border-border flex w-70 shrink-0 flex-col border-r">
      <div className="border-border border-b p-3">
        <Typography affects={["small", "medium"]}>{t("templates.editor.layersTitle")}</Typography>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <LayersList editor={editor} interaction={interaction} disabled={disabled} />
      </ScrollArea>
    </aside>
  )
}

export { EditorLeftPanel }
