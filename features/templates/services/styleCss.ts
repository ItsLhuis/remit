import {
  type BlockStyle,
  type TemplateFontKey,
  type TemplatePageSettings,
  type TemplateType
} from "../schemas"

import { getPageWidth } from "./canvasLayout"

// The single style-emission path: every CSS declaration the renderer produces for author-tunable
// presentation flows through these mappers, and the sanitizer's "document" profile whitelists the
// result property-by-property (services/sanitizeHtml.ts). Add a property here and in the
// whitelist together — never inline style strings in the renderer.

export const TEMPLATE_FONT_STACKS = {
  sans: "'DM Sans', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'Courier New', monospace"
} as const satisfies Record<TemplateFontKey, string>

// The single rotation-emission form: absent/zero rotation emits nothing at all (a rotation-free
// document renders byte-identically to one produced before rotation existed), nonzero emits
// exactly `transform:rotate(<n>deg)` — the sanitizer whitelists this form and nothing else, never
// matrix(). CSS's default transform-origin (the element's center) matches the stored convention of
// rotation about the rect's center.
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

// The page is a relatively positioned surface with an exact height (getPageHeight) so blocks can
// sit at absolute rectangles; margins apply as block offsets, not page padding.
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
