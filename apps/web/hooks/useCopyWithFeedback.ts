"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function useCopyWithFeedback(delay = 2000) {
  const [copied, setCopied] = useState(false)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)

        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        setCopied(true)

        timeoutRef.current = setTimeout(() => setCopied(false), delay)
      } catch {
        // Ignored: the Clipboard API rejects when permission is denied or the page is not in a
        // secure context. Leaving `copied` false is the correct outcome — no success feedback is
        // shown for a copy that did not happen, and there is no user action that would fix it.
      }
    },
    [delay]
  )

  return { copied, copy }
}
