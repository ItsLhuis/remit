"use client"

import { useTranslation } from "@/lib/i18n"

import { type TemplateEditorState } from "../hooks"
import { BLOCK_LABEL_KEYS } from "../labels"

import { announce, shouldAnnounceGestureProgress } from "./announcer"
import { type UseCanvasEngineOptions } from "./frameTick"

// Every gesture callback the engine fires purely to narrate itself to a screen reader. They are one
// concern - turn an engine event into a live-region sentence - and they need no canvas DOM at all,
// only the block index for a block's name, which is why they lift cleanly off the canvas host.
type CanvasAnnouncers = Pick<
  UseCanvasEngineOptions,
  | "onGestureStart"
  | "onGestureEnd"
  | "onGestureCancel"
  | "onEnterTextEdit"
  | "onMarqueeSelect"
  | "onMoveProgress"
  | "onResizeProgress"
  | "onRotateProgress"
  | "onMarqueeProgress"
  | "onMarqueeCancel"
>

export function useCanvasAnnouncers(editor: TemplateEditorState): CanvasAnnouncers {
  const { t } = useTranslation()

  const nameFor = (ids: readonly string[]): string => {
    const first = ids[0] === undefined ? undefined : editor.blockIndex.get(ids[0])

    return first ? t(BLOCK_LABEL_KEYS[first.block.type]) : ""
  }

  return {
    onGestureStart: (ids) => announce(t("templates.editor.gesture.start", { name: nameFor(ids) })),
    onGestureEnd: (ids, position) =>
      announce(
        t("templates.editor.gesture.end", {
          name: nameFor(ids),
          position: `${position.x}, ${position.y}`
        })
      ),
    onGestureCancel: (ids) =>
      announce(t("templates.editor.gesture.cancel", { name: nameFor(ids) })),
    onEnterTextEdit: (id) =>
      announce(t("templates.editor.textEdit.enter", { name: nameFor([id]) })),
    onMarqueeSelect: (ids) =>
      announce(t("templates.editor.selection.marquee", { count: ids.length })),
    onMoveProgress: (ids, position) => {
      if (!shouldAnnounceGestureProgress()) return

      announce(
        t("templates.editor.gesture.move", {
          name: nameFor(ids),
          position: `${position.x}, ${position.y}`
        })
      )
    },
    onResizeProgress: (ids, size) => {
      if (!shouldAnnounceGestureProgress()) return

      announce(
        t("templates.editor.gesture.resize", {
          name: nameFor(ids),
          width: size.width,
          height: size.height
        })
      )
    },
    onRotateProgress: (ids, degrees) => {
      if (!shouldAnnounceGestureProgress()) return

      announce(t("templates.editor.gesture.rotate", { name: nameFor(ids), degrees }))
    },
    onMarqueeProgress: (count) => {
      if (!shouldAnnounceGestureProgress()) return

      announce(t("templates.editor.selection.marquee", { count }))
    },
    onMarqueeCancel: () => announce(t("templates.editor.selection.marqueeCancel"))
  }
}
