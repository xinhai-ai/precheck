import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { allowedEmailDomains as defaultEmailDomains } from "@/lib/pre-application/constants"
import {
  DEFAULT_ESSAY_MAX_LENGTH,
  DEFAULT_ESSAY_MIN_LENGTH,
  normalizeEssayLengthLimits,
} from "@/lib/pre-application/essay-limits"

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({
        preApplicationEssayHint: "建议 100 字左右,避免夸赞社区与版主,只说明你的目的与需求。",
        preApplicationEssayMinLength: DEFAULT_ESSAY_MIN_LENGTH,
        preApplicationEssayMaxLength: DEFAULT_ESSAY_MAX_LENGTH,
        allowedEmailDomains: defaultEmailDomains,
      })
    }

    const settings = await db.siteSettings.findUnique({
      where: { id: "global" },
      select: {
        preApplicationEssayHint: true,
        preApplicationEssayMinLength: true,
        preApplicationEssayMaxLength: true,
        allowedEmailDomains: true,
      },
    })

    if (!settings) {
      return NextResponse.json({
        preApplicationEssayHint: "建议 100 字左右,避免夸赞社区与版主,只说明你的目的与需求。",
        preApplicationEssayMinLength: DEFAULT_ESSAY_MIN_LENGTH,
        preApplicationEssayMaxLength: DEFAULT_ESSAY_MAX_LENGTH,
        allowedEmailDomains: defaultEmailDomains,
      })
    }

    const limits = normalizeEssayLengthLimits(
      settings.preApplicationEssayMinLength,
      settings.preApplicationEssayMaxLength,
    )

    return NextResponse.json({
      preApplicationEssayHint: settings.preApplicationEssayHint,
      preApplicationEssayMinLength: limits.min,
      preApplicationEssayMaxLength: limits.max,
      allowedEmailDomains: Array.isArray(settings.allowedEmailDomains)
        ? settings.allowedEmailDomains
        : defaultEmailDomains,
    })
  } catch (error) {
    console.error("Public system config fetch error:", error)
    return NextResponse.json(
      {
        preApplicationEssayHint: "建议 100 字左右,避免夸赞社区与版主,只说明你的目的与需求。",
        preApplicationEssayMinLength: DEFAULT_ESSAY_MIN_LENGTH,
        preApplicationEssayMaxLength: DEFAULT_ESSAY_MAX_LENGTH,
        allowedEmailDomains: defaultEmailDomains,
      },
      { status: 500 },
    )
  }
}
