import { getPreApplicationSubmitLimits } from "@/lib/pre-application/submit-limits"
import {
  getShanghaiDayQuotaInfo,
  isWithinShanghaiSubmitWindow,
} from "@/lib/pre-application/submit-limits-utils"
import { getPreApplicationSubmitQuotaSnapshot } from "@/lib/pre-application/submit-quota"

export type SubmitQuotaStatus = {
  dailyGlobalLimit: number
  dailyUserLimit: number
  submitStartTime: string
  submitEndTime: string
  isWithinSubmitWindow: boolean
  quotaServiceAvailable: boolean
  userUsedToday: number | null
  userRemainingToday: number | null
  globalUsedToday: number | null
  globalRemainingToday: number | null
}

export type SubmitEligibilityReason =
  | "submit_window_closed"
  | "user_quota_insufficient"
  | "quota_insufficient"
  | "service_unavailable"

export async function getSubmitQuotaStatusForIdentity(identity: string): Promise<SubmitQuotaStatus> {
  const limits = await getPreApplicationSubmitLimits()
  const now = new Date()
  const quotaInfo = getShanghaiDayQuotaInfo(now)
  const isWithinSubmitWindow = isWithinShanghaiSubmitWindow(
    now,
    limits.submitStartTime,
    limits.submitEndTime,
  )

  const snapshot = await getPreApplicationSubmitQuotaSnapshot({
    identity,
    dayKey: quotaInfo.dayKey,
    dailyGlobalLimit: limits.dailyGlobalLimit,
    dailyUserLimit: limits.dailyUserLimit,
  })

  if (!snapshot.ok) {
    return {
      dailyGlobalLimit: limits.dailyGlobalLimit,
      dailyUserLimit: limits.dailyUserLimit,
      submitStartTime: limits.submitStartTime,
      submitEndTime: limits.submitEndTime,
      isWithinSubmitWindow,
      quotaServiceAvailable: false,
      userUsedToday: null,
      userRemainingToday: null,
      globalUsedToday: null,
      globalRemainingToday: null,
    }
  }

  return {
    dailyGlobalLimit: limits.dailyGlobalLimit,
    dailyUserLimit: limits.dailyUserLimit,
    submitStartTime: limits.submitStartTime,
    submitEndTime: limits.submitEndTime,
    isWithinSubmitWindow,
    quotaServiceAvailable: true,
    userUsedToday: snapshot.userUsedToday,
    userRemainingToday: snapshot.userRemainingToday,
    globalUsedToday: snapshot.globalUsedToday,
    globalRemainingToday: snapshot.globalRemainingToday,
  }
}

export async function checkPreApplicationSubmitEligibility(identity: string): Promise<{
  allowed: boolean
  reason?: SubmitEligibilityReason
  submitQuotaStatus: SubmitQuotaStatus
}> {
  const submitQuotaStatus = await getSubmitQuotaStatusForIdentity(identity)

  if (!submitQuotaStatus.isWithinSubmitWindow) {
    return { allowed: false, reason: "submit_window_closed", submitQuotaStatus }
  }

  if (!submitQuotaStatus.quotaServiceAvailable) {
    return { allowed: false, reason: "service_unavailable", submitQuotaStatus }
  }

  if ((submitQuotaStatus.userRemainingToday ?? 0) <= 0) {
    return { allowed: false, reason: "user_quota_insufficient", submitQuotaStatus }
  }

  if ((submitQuotaStatus.globalRemainingToday ?? 0) <= 0) {
    return { allowed: false, reason: "quota_insufficient", submitQuotaStatus }
  }

  return { allowed: true, submitQuotaStatus }
}
