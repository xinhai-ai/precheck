import test from "node:test"
import assert from "node:assert/strict"

async function loadChatMessageUrlModule() {
  return import(new URL("../../lib/chat-message-url.ts", import.meta.url).href)
}

test("allow pasted image data urls for chat images", async () => {
  const { getSafeChatImageUrl } = await loadChatMessageUrlModule()

  assert.equal(
    getSafeChatImageUrl("data:image/jpeg;base64,QUJDRA=="),
    "data:image/jpeg;base64,QUJDRA==",
  )
})

test("reject remote or unsafe chat image urls", async () => {
  const { getSafeChatImageUrl } = await loadChatMessageUrlModule()

  assert.equal(getSafeChatImageUrl("https://example.com/a.png"), undefined)
  assert.equal(getSafeChatImageUrl("http://127.0.0.1:80/a.png"), undefined)
  assert.equal(getSafeChatImageUrl("data:text/html;base64,PHNjcmlwdD4="), undefined)
})

test("allow only safe chat links", async () => {
  const { getSafeChatLinkUrl } = await loadChatMessageUrlModule()

  assert.equal(getSafeChatLinkUrl("https://example.com/path"), "https://example.com/path")
  assert.equal(getSafeChatLinkUrl("/dashboard/messages"), "/dashboard/messages")
  assert.equal(getSafeChatLinkUrl("javascript:alert(1)"), undefined)
  assert.equal(getSafeChatLinkUrl("http://127.0.0.1:80"), undefined)
  assert.equal(getSafeChatLinkUrl("https://localhost/test"), undefined)
})
