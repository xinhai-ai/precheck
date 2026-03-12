import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { allowedEmailDomains as defaultEmailDomains } from "@/lib/pre-application/constants"
import {
  DEFAULT_ESSAY_MAX_LENGTH,
  DEFAULT_ESSAY_MIN_LENGTH,
  normalizeEssayLengthLimits,
} from "@/lib/pre-application/essay-limits"
import {
  DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT,
  DEFAULT_PREAPP_DAILY_USER_LIMIT,
  DEFAULT_PREAPP_SUBMIT_END_TIME,
  DEFAULT_PREAPP_SUBMIT_START_TIME,
  normalizeSubmitLimits,
} from "@/lib/pre-application/submit-limits-utils"

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({
        preApplicationEssayHint: "建议 100 字左右,避免夸赞社区与版主,只说明你的目的与需求。",
        preApplicationEssayMinLength: DEFAULT_ESSAY_MIN_LENGTH,
        preApplicationEssayMaxLength: DEFAULT_ESSAY_MAX_LENGTH,
        preApplicationDailyGlobalLimit: DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT,
        preApplicationDailyUserLimit: DEFAULT_PREAPP_DAILY_USER_LIMIT,
        preApplicationSubmitStartTime: DEFAULT_PREAPP_SUBMIT_START_TIME,
        preApplicationSubmitEndTime: DEFAULT_PREAPP_SUBMIT_END_TIME,
        allowedEmailDomains: defaultEmailDomains,
        registerQqNumberEmailOnly: false,
      })
    }

    const settings = await db.siteSettings.findUnique({
      where: { id: "global" },
      select: {
        preApplicationEssayHint: true,
        preApplicationEssayMinLength: true,
        preApplicationEssayMaxLength: true,
        preApplicationDailyGlobalLimit: true,
        preApplicationDailyUserLimit: true,
        preApplicationSubmitStartTime: true,
        preApplicationSubmitEndTime: true,
        allowedEmailDomains: true,
        registerQqNumberEmailOnly: true,
      },
    })

    if (!settings) {
      return NextResponse.json({
        preApplicationEssayHint: "建议 100 字左右,避免夸赞社区与版主,只说明你的目的与需求。",
        preApplicationEssayMinLength: DEFAULT_ESSAY_MIN_LENGTH,
        preApplicationEssayMaxLength: DEFAULT_ESSAY_MAX_LENGTH,
        preApplicationDailyGlobalLimit: DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT,
        preApplicationDailyUserLimit: DEFAULT_PREAPP_DAILY_USER_LIMIT,
        preApplicationSubmitStartTime: DEFAULT_PREAPP_SUBMIT_START_TIME,
        preApplicationSubmitEndTime: DEFAULT_PREAPP_SUBMIT_END_TIME,
        allowedEmailDomains: defaultEmailDomains,
        registerQqNumberEmailOnly: false,
      })
    }

    const limits = normalizeEssayLengthLimits(
      settings.preApplicationEssayMinLength,
      settings.preApplicationEssayMaxLength,
    )
    const submitLimits = normalizeSubmitLimits({
      dailyGlobalLimit: settings.preApplicationDailyGlobalLimit,
      dailyUserLimit: settings.preApplicationDailyUserLimit,
      submitStartTime: settings.preApplicationSubmitStartTime,
      submitEndTime: settings.preApplicationSubmitEndTime,
    })

    return NextResponse.json({
      preApplicationEssayHint: settings.preApplicationEssayHint,
      preApplicationEssayMinLength: limits.min,
      preApplicationEssayMaxLength: limits.max,
      preApplicationDailyGlobalLimit: submitLimits.dailyGlobalLimit,
      preApplicationDailyUserLimit: submitLimits.dailyUserLimit,
      preApplicationSubmitStartTime: submitLimits.submitStartTime,
      preApplicationSubmitEndTime: submitLimits.submitEndTime,
      allowedEmailDomains: Array.isArray(settings.allowedEmailDomains)
        ? settings.allowedEmailDomains
        : defaultEmailDomains,
      registerQqNumberEmailOnly: settings.registerQqNumberEmailOnly ?? false,
    })
  } catch (error) {
    console.error("Public system config fetch error:", error)
    return NextResponse.json(
      {
        preApplicationEssayHint: "建议 100 字左右,避免夸赞社区与版主,只说明你的目的与需求。",
        preApplicationEssayMinLength: DEFAULT_ESSAY_MIN_LENGTH,
        preApplicationEssayMaxLength: DEFAULT_ESSAY_MAX_LENGTH,
        preApplicationDailyGlobalLimit: DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT,
        preApplicationDailyUserLimit: DEFAULT_PREAPP_DAILY_USER_LIMIT,
        preApplicationSubmitStartTime: DEFAULT_PREAPP_SUBMIT_START_TIME,
        preApplicationSubmitEndTime: DEFAULT_PREAPP_SUBMIT_END_TIME,
        allowedEmailDomains: defaultEmailDomains,
        registerQqNumberEmailOnly: false,
      },
      { status: 500 },
    )
  }
}
