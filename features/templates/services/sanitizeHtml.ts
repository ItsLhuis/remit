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

// The exact declarations the absolute-position renderer emits (pageStyleToCss, blockStyleToCss,
// absoluteBlockHtml, frameHtml, tableHtml) - nothing more. Every property is whitelisted
// value-by-value; each entry names its emitter:
// - position/left/top: absoluteBlockHtml block rectangles and frameHtml's absolute children;
//   position:relative is the page surface and the frame container.
// - width/height: block rectangles, frame children, table column widths; 100% is the image fill,
//   the frame fill, and the table's own width.
// - overflow:hidden: frameHtml's clip toggle (a frame with clip:true clips overflowing children).
// - border-collapse/vertical-align: tableHtml's table and cell declarations.
// - The font-family patterns are the three TEMPLATE_FONT_STACKS strings.
// - border-radius additionally allows 50%: shapeHtml forces it for the ellipse shape variant.
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
      // Exactly rotationToCss's emitted form: a degrees value in [0, 360) quantized to a tenth
      // (services/rotateMath.ts's quantizeDegrees). Never matrix() — see ADR-0024.
      transform: [/^rotate\((?:[0-9]|[1-9][0-9]|[12][0-9]{2}|3[0-5][0-9])(?:\.[0-9])?deg\)$/]
    }
  },
  disallowedTagsMode: "discard"
}

export function sanitizeTemplateHtml(
  html: string,
  options: SanitizeTemplateHtmlOptions = {}
): string {
  return sanitize(html, options.profile === "document" ? DOCUMENT_OPTIONS : AUTHORED_OPTIONS)
}

// Plain-text extraction for the text render format. sanitize-html strips the markup but
// entity-escapes the remaining text, so the inverse of the canonical escapeHtml (lib/utils) restores
// the raw characters.
export function toPlainText(html: string): string {
  const stripped = sanitize(html, { allowedTags: [], allowedAttributes: {} })

  return stripped
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}
