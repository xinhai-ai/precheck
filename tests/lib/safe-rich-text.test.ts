import test from "node:test"
import assert from "node:assert/strict"

async function loadSafeRichTextModule() {
  return import(new URL("../../lib/safe-rich-text.ts", import.meta.url).href)
}

test("convert plain text into escaped paragraphs", async () => {
  const { normalizeSafeRichTextHtml } = await loadSafeRichTextModule()

  assert.equal(
    normalizeSafeRichTextHtml("hello\n\n<script>alert(1)</script>"),
    "<p>hello</p><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
  )
})

test("keep basic formatting while stripping dangerous html", async () => {
  const { normalizeSafeRichTextHtml } = await loadSafeRichTextModule()

  const html = normalizeSafeRichTextHtml(
    '<p onclick="alert(1)">Hi <strong>there</strong></p><img src="https://evil.test/x.png" onerror="alert(1)" /><script>alert(1)</script><a href="javascript:alert(1)">click</a>',
  )

  assert.equal(html.includes("<p>Hi <strong>there</strong></p>"), true)
  assert.equal(html.includes("<img"), false)
  assert.equal(html.includes("<script"), false)
  assert.equal(html.includes("onclick"), false)
  assert.equal(html.includes("javascript:"), false)
  assert.equal(html.includes("<a"), false)
})

test("preserve code blocks and list markup without keeping arbitrary attributes", async () => {
  const { normalizeSafeRichTextHtml } = await loadSafeRichTextModule()

  const html = normalizeSafeRichTextHtml(
    '<pre class="language-ts"><code data-test="1">const x = 1</code></pre><ul><li style="color:red">one</li><li>two</li></ul>',
  )

  assert.equal(html, "<pre><code>const x = 1</code></pre><ul><li>one</li><li>two</li></ul>")
})
