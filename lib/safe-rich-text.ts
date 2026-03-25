const SAFE_HTML_TAG_RE = /<\/?(?:blockquote|br|code|em|h[1-6]|hr|li|ol|p|pre|s|strong|ul)\b[^>]*>/i
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g
const HTML_TAG_TOKEN_RE = /<\/?([a-z0-9]+)(?:\s[^<>]*?)?\s*\/?>/gi

const ALLOWED_TAGS = new Set([
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "strong",
  "ul",
])

const SELF_CLOSING_TAGS = new Set(["br", "hr"])
const STRIP_WITH_CONTENT_TAGS = [
  "embed",
  "iframe",
  "math",
  "object",
  "script",
  "style",
  "svg",
  "template",
]

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function normalizePlainText(value: string) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("")
}

function stripDangerousElements(value: string) {
  let sanitized = value.replace(HTML_COMMENT_RE, "")

  for (const tag of STRIP_WITH_CONTENT_TAGS) {
    sanitized = sanitized.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "")
  }

  return sanitized
}

function sanitizeAllowedTags(value: string) {
  return value.replace(HTML_TAG_TOKEN_RE, (full, rawTagName: string) => {
    const tagName = rawTagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tagName)) {
      return ""
    }

    if (SELF_CLOSING_TAGS.has(tagName)) {
      return `<${tagName}>`
    }

    return full.startsWith("</") ? `</${tagName}>` : `<${tagName}>`
  })
}

export function normalizeSafeRichTextHtml(value?: string | null): string {
  const raw = value?.trim() ?? ""
  if (!raw) return ""

  if (!SAFE_HTML_TAG_RE.test(raw)) {
    return normalizePlainText(raw)
  }

  return sanitizeAllowedTags(stripDangerousElements(raw)).trim()
}
