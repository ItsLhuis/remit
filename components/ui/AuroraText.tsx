"use client"

import { type ReactNode } from "react"

type AuroraTextProps = {
  children: ReactNode
  className?: string
  colors?: string[]
  speed?: number
}

const AuroraText = ({
  children,
  className = "",
  colors = [
    "oklch(0.78 0.16 264)",
    "oklch(0.65 0.22 250)",
    "oklch(0.82 0.12 280)",
    "oklch(0.70 0.20 240)"
  ],
  speed = 1
}: AuroraTextProps) => {
  const gradientStyle = {
    backgroundImage: `linear-gradient(135deg, ${colors.join(", ")}, ${colors[0]})`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",animationDuration: `${10 / speed}s`
  }

  return (
    <span
      className={`relative inline-block ${className}`}
      aria-label={typeof children === "string" ? children : undefined}
    >
      <span
        className="animate-aurora relative bg-size-[200%_auto] bg-clip-text text-transparent"
        style={gradientStyle}
        aria-hidden="true"
      >
        {children}
      </span>
    </span>
  )
}

export { AuroraText }
