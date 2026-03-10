import { type NextRequest, NextResponse } from "next/server"

function createGuestSubmitDisabledResponse() {
  return NextResponse.json({ error: "游客提交已关闭，请登录后申请" }, { status: 403 })
}

export async function POST(_request: NextRequest) {
  return createGuestSubmitDisabledResponse()
}

export async function GET() {
  return createGuestSubmitDisabledResponse()
}
