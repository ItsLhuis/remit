"use client"

import { useEffect, useState } from "react"

// Tracks the content width of the element the returned ref is attached to, so fixed-size render
// output can be scaled down to whatever width the layout actually gives it. The element is held in
// state rather than a ref object because the observed node mounts after the first render inside a
// dialog, and a ref object would not re-run the effect when it appears.
export function useMeasuredWidth() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (entry) setWidth(entry.contentRect.width)
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [element])

  return { ref: setElement, width }
}
