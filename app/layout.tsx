import { type ReactNode } from "react"

import { type Metadata } from "next"

import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"

import { cn } from "@/lib/utils"

import { TooltipProvider } from "@/components/ui"
import { ThemeProvider } from "@/providers/ThemeProvider"

import "./globals.css"

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans"
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
})

export const metadata: Metadata = {
  title: {
    template: "%s - Remit",
    default: "Remit"
  },
  description: "Self-hosted business management for freelancers."
}

const RootLayout = ({
  children
}: Readonly<{
  children: ReactNode
}>) => {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, fontMono.variable)}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

export default RootLayout
