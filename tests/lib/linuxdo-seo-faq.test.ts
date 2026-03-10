import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const layoutSource = readFileSync(new URL("../../app/[locale]/layout.tsx", import.meta.url), "utf8")
const zhSource = readFileSync(new URL("../../dictionaries/zh.json", import.meta.url), "utf8")
const enSource = readFileSync(new URL("../../dictionaries/en.json", import.meta.url), "utf8")

function countOccurrences(source: string, text: string) {
  return source.split(text).length - 1
}

test("shared metadata keywords include Linux.do SEO terms", () => {
  assert.match(layoutSource, /"Linux\.do"/)
  assert.match(layoutSource, /"Linux\.do 邀请码"/)
  assert.match(layoutSource, /"Linux\.do 预申请"/)
})

test("localized metadata titles and descriptions mention Linux.do", () => {
  assert.match(zhSource, /"title": "Linux\.do 预申请系统"/)
  assert.match(zhSource, /"description": "面向 Linux\.do 社区的预申请与邀请码管理系统"/)
  assert.match(enSource, /"title": "Linux\.do Pre-Application System"/)
  assert.match(
    enSource,
    /"description": "Pre-application and invite code management system for the Linux\.do community"/,
  )
})

test("homepage and docs FAQ clarify the site is not official Linux.do", () => {
  const zhQuestion = '"q": "这是 Linux.do 官方网站吗？"'
  const zhAnswer = '"a": "不是，这是热心三级佬友组建的网站，方便想加入社区的佬友获取邀请码。"'
  const zhHomepageQuestion = '"question": "这是 Linux.do 官方网站吗？"'
  const zhHomepageAnswer =
    '"answer": "不是，这是热心三级佬友组建的网站，方便想加入社区的佬友获取邀请码。"'

  assert.equal(countOccurrences(zhSource, zhQuestion), 1)
  assert.equal(countOccurrences(zhSource, zhAnswer), 1)
  assert.equal(countOccurrences(zhSource, zhHomepageQuestion), 1)
  assert.equal(countOccurrences(zhSource, zhHomepageAnswer), 1)

  const enQuestion = '"q": "Is this an official Linux.do website?"'
  const enAnswer =
    '"a": "No. This is a community-run site built by enthusiastic Linux.do members to help people who want to join the community get invite codes."'
  const enHomepageQuestion = '"question": "Is this an official Linux.do website?"'
  const enHomepageAnswer =
    '"answer": "No. This is a community-run site built by enthusiastic Linux.do members to help people who want to join the community get invite codes."'

  assert.equal(countOccurrences(enSource, enQuestion), 1)
  assert.equal(countOccurrences(enSource, enAnswer), 1)
  assert.equal(countOccurrences(enSource, enHomepageQuestion), 1)
  assert.equal(countOccurrences(enSource, enHomepageAnswer), 1)
})
