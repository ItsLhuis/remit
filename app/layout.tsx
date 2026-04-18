import { type ReactNode } from "react"

import { type Metadata } from "next"

import { DM_Sans, JetBrains_Mono } from "next/font/google"

import { cn } from "@/lib/utils"

import { Toaster, TooltipProvider } from "@/components/ui"
import { ThemeProvider } from "@/providers/ThemeProvider"

import "./globals.css"

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans"
})

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
})

export const metadata: Metadata = {
  title: {
    template: "%s | Remit",
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
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

export default RootLayout
