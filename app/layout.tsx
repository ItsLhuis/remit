import { type ReactNode } from "react"

import { type Metadata } from "next"

import { DM_Sans, Inter, JetBrains_Mono } from "next/font/google"

import { cn } from "@/lib/utils"

import { Toaster, TooltipProvider } from "@/components/ui"
import { AppearanceProvider } from "@/providers/AppearanceProvider"
import { I18nProvider } from "@/providers/I18nProvider"
import { ThemeProvider } from "@/providers/ThemeProvider"

import "./globals.css"

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans"
})

const fontInter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
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

const APPEARANCE_SCRIPT = `(function(){try{
  var d=document.documentElement;
  var f=localStorage.getItem('font-size')||'default';
  var n=localStorage.getItem('density')||'default';
  var m=localStorage.getItem('font-family')||'sans';
  d.setAttribute('data-font-size',f);
  d.setAttribute('data-density',n);
  d.setAttribute('data-font-family',m);
}catch(e){}})();`

const RootLayout = ({
  children
}: Readonly<{
  children: ReactNode
}>) => {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, fontInter.variable, fontMono.variable)}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
        <ThemeProvider>
          <AppearanceProvider>
            <I18nProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </I18nProvider>
          </AppearanceProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

export default RootLayout
