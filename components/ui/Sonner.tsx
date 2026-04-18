"use client"

import { type CSSProperties } from "react"

import { useTheme } from "next-themes"

import { Toaster as Sonner, type ToasterProps, toast } from "sonner"

import { Icon } from "@/components/ui/Icon"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <Icon name="CircleCheck" className="size-4" />,
        info: <Icon name="Info" className="size-4" />,
        warning: <Icon name="TriangleAlert" className="size-4" />,
        error: <Icon name="OctagonX" className="size-4" />,
        loading: <Icon name="Loader2" className="size-4 animate-spin" />
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)"
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast"
        }
      }}
      closeButton
      {...props}
    />
  )
}

export { Toaster, toast }
