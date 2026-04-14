import { useCallback, useState } from "react"

export function useScroll() {
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return

    const update = () => {
      setCanScrollUp(element.scrollTop > 0)
      setCanScrollDown(element.scrollTop < element.scrollHeight - element.clientHeight - 1)
    }

    update()

    element.addEventListener("scroll", update, { passive: true })

    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => {
      element.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [])

  return { ref, canScrollUp, canScrollDown }
}
