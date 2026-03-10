import { NextRequest, NextResponse } from "next/server"

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: "游客提交已关闭，请登录后申请" }, { status: 403 })
}
