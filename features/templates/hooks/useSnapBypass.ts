"use client"

import { useCallback, useEffect, useRef } from "react"

// Tracks whether Alt is held so an in-flight pointer drag can consult it: the grid-snap modifier
// calls the returned getter live at apply time, so holding Alt mid-drag switches to a free off-grid
// move on the next pointer move without a re-render. Syncing from `event.altKey` on both keydown and
// keyup keeps the flag correct through modifier chords, and a window blur clears it so an Alt+Tab
// away never leaves snapping stuck off.
export function useSnapBypass(): () => boolean {
  const heldRef = useRef(false)

  useEffect(() => {
    const sync = (event: KeyboardEvent) => {
      heldRef.current = event.altKey
    }

    const clear = () => {
      heldRef.current = false
    }

    window.addEventListener("keydown", sync)
    window.addEventListener("keyup", sync)
    window.addEventListener("blur", clear)

    return () => {
      window.removeEventListener("keydown", sync)
      window.removeEventListener("keyup", sync)
      window.removeEventListener("blur", clear)
    }
  }, [])

  return useCallback(() => heldRef.current, [])
}
