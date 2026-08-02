import sanitize from "sanitize-html"

// The single sanitizer entry point and the single canonical HTML-escape consumer for the templates
// feature. Two profiles cover the two trust boundaries:
// - "authored": text-block HTML written by a template author, sanitized at save time. No <img>
//   (images exist only through the image block, which stores an upload id), no style attributes, no
//   unsafe URL schemes.
// - "document": the fully assembled render output. Adds the renderer-generated <img> and the exact
//   layout style properties the renderer emits; authored content inside it was already restricted by
//   the "authored" pass, so the style whitelist only has to admit renderer output.

type SanitizeProfile = "authored" | "document"

type SanitizeTemplateHtmlOptions = {
  profile?: SanitizeProfile
}

const AUTHORED_TAGS = [
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "span",
  "div",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "a"
]

const AUTHORED_OPTIONS: sanitize.IOptions = {
  allowedTags: AUTHORED_TAGS,
  allowedAttributes: {
    a: ["href", "title"]
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard"
}

const LAYOUT_LENGTH = [/^\d+(?:\.\d+)?px$/]
const HEX_COLOR = [/^#[0-9a-fA-F]{6}$/]
const HAIRLINE_BORDER = [/^\d+px solid #[0-9a-fA-F]{6}$/]

// The exact declarations the renderer emits and nothing more, whitelisted value-by-value. The
// emitters are pageStyleToCss, blockStyleToCss, absoluteBlockHtml, frameHtml, tableHtml and
// shapeHtml, whose ellipse variant is why border-radius additionally admits 50%.
const DOCUMENT_OPTIONS: sanitize.IOptions = {
  allowedTags: [...AUTHORED_TAGS, "img", "table", "thead", "tbody", "tr", "th", "td"],
  allowedAttributes: {
    a: ["href", "title"],
    img: ["src", "alt", "style"],
    div: ["style"],
    h1: ["style"],
    h2: ["style"],
    h3: ["style"],
    table: ["style"],
    th: ["style"],
    td: ["style"]
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedStyles: {
    "*": {
      position: [/^absolute$/, /^relative$/],
      left: LAYOUT_LENGTH,
      top: LAYOUT_LENGTH,
      width: [...LAYOUT_LENGTH, /^100%$/],
      height: [...LAYOUT_LENGTH, /^100%$/],
      margin: [/^0$/],
      padding: [/^\d+px(?: \d+px){0,3}$/],
      overflow: [/^hidden$/],
      "background-color": HEX_COLOR,
      border: HAIRLINE_BORDER,
      "border-radius": [...LAYOUT_LENGTH, /^50%$/],
      "border-collapse": [/^collapse$/],
      "vertical-align": [/^top$/],
      "font-family": [
        /^'DM Sans', system-ui, sans-serif$/,
        /^Georgia, 'Times New Roman', serif$/,
        /^'JetBrains Mono', 'Courier New', monospace$/
      ],
      "font-size": LAYOUT_LENGTH,
      "font-weight": [/^(?:300|400|500|600|700)$/],
      color: HEX_COLOR,
      "text-align": [/^(?:left|center|right)$/],
      "line-height": [/^\d+(?:\.\d+)?$/],
      "object-fit": [/^contain$/],
      // Exactly rotationToCss's emitted form, quantized to a tenth by rotateMath.ts. Never
      // matrix() - see ADR-0024.
      transform: [/^rotate\((?:[0-9]|[1-9][0-9]|[12][0-9]{2}|3[0-5][0-9])(?:\.[0-9])?deg\)$/]
    }
  },
  disallowedTagsMode: "discard"
}

declare const sanitizedHtmlBrand: unique symbol

// The brand cannot be produced outside this module, so holding a SanitizedHtml is proof the
// sanitizer ran. It stays assignable to string; only the reverse is blocked, which is the point. A
// DOM sink unwraps through unwrapSanitizedHtml, making the trust boundary one greppable call.
export type SanitizedHtml = string & { readonly [sanitizedHtmlBrand]: true }

export function sanitizeTemplateHtml(
  html: string,
  options: SanitizeTemplateHtmlOptions = {}
): SanitizedHtml {
  return sanitize(
    html,
    options.profile === "document" ? DOCUMENT_OPTIONS : AUTHORED_OPTIONS
  ) as SanitizedHtml
}

export function unwrapSanitizedHtml(html: SanitizedHtml): string {
  return html
}

// sanitize-html strips the markup but entity-escapes what remains, so the inverse of the canonical
// escapeHtml restores the raw characters.
export function toPlainText(html: string): string {
  const stripped = sanitize(html, { allowedTags: [], allowedAttributes: {} })

  return stripped
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}
