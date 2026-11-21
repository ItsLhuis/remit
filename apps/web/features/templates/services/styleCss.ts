import {
  type BlockStyle,
  type TemplateFontKey,
  type TemplatePageSettings,
  type TemplateType
} from "../schemas"

import { getPageWidth } from "./canvasLayout"

// The single style-emission path: the sanitizer's "document" profile whitelists the result
// property-by-property, so a property is added here and in sanitizeHtml.ts together. Never inline
// a style string in the renderer.

export const TEMPLATE_FONT_STACKS = {
  sans: "'DM Sans', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'Courier New', monospace"
} as const satisfies Record<TemplateFontKey, string>

// Zero emits nothing at all, so a rotation-free document renders byte-identically to one produced
// before rotation existed. Nonzero emits exactly `transform:rotate(<n>deg)`, the only form the
// sanitizer whitelists. CSS's default transform-origin already matches the stored convention.
export function rotationToCss(rotation: number | undefined): string {
  if (rotation === undefined || rotation === 0) return ""

  return `transform:rotate(${rotation}deg)`
}

export function blockStyleToCss(style: BlockStyle | undefined): string {
  if (!style) return ""

  const declarations: string[] = []

  if (style.padding) {
    const { top, right, bottom, left } = style.padding

    declarations.push(`padding:${top}px ${right}px ${bottom}px ${left}px`)
  }

  if (style.backgroundColor) declarations.push(`background-color:${style.backgroundColor}`)

  if (style.borderWidth && style.borderWidth > 0) {
    declarations.push(`border:${style.borderWidth}px solid ${style.borderColor ?? "#e2e8f0"}`)
  }

  if (style.borderRadius !== undefined && style.borderRadius > 0) {
    declarations.push(`border-radius:${style.borderRadius}px`)
  }

  if (style.fontFamily) declarations.push(`font-family:${TEMPLATE_FONT_STACKS[style.fontFamily]}`)
  if (style.fontSize !== undefined) declarations.push(`font-size:${style.fontSize}px`)
  if (style.fontWeight) declarations.push(`font-weight:${style.fontWeight}`)
  if (style.textColor) declarations.push(`color:${style.textColor}`)
  if (style.textAlign) declarations.push(`text-align:${style.textAlign}`)
  if (style.lineHeight !== undefined) declarations.push(`line-height:${style.lineHeight}`)

  return declarations.join(";")
}

// An exact height from getPageHeight, so blocks can sit at absolute rectangles; margins apply as
// block offsets rather than page padding.
export function pageStyleToCss(
  type: TemplateType,
  pageSettings: TemplatePageSettings,
  pageHeight: number
): string {
  const { fontFamily, baseFontSize } = pageSettings

  const declarations = [
    "position:relative",
    `width:${getPageWidth(type)}px`,
    `height:${pageHeight}px`,
    `font-family:${TEMPLATE_FONT_STACKS[fontFamily]}`,
    `font-size:${baseFontSize}px`,
    "color:#0f172a",
    "background-color:#ffffff"
  ]

  return declarations.join(";")
}
