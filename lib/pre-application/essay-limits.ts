import { db } from "@/lib/db"
import {
  DEFAULT_ESSAY_MAX_LENGTH,
  DEFAULT_ESSAY_MIN_LENGTH,
  normalizeEssayLengthLimits,
} from "./essay-limits-utils"

export { DEFAULT_ESSAY_MAX_LENGTH, DEFAULT_ESSAY_MIN_LENGTH, normalizeEssayLengthLimits }

export async function getEssayLengthLimits(): Promise<{ min: number; max: number }> {
  if (!db) {
    return {
      min: DEFAULT_ESSAY_MIN_LENGTH,
      max: DEFAULT_ESSAY_MAX_LENGTH,
    }
  }

  try {
    const settings = await db.siteSettings.findUnique({
      where: { id: "global" },
      select: {
        preApplicationEssayMinLength: true,
        preApplicationEssayMaxLength: true,
      },
    })

    return normalizeEssayLengthLimits(
      settings?.preApplicationEssayMinLength,
      settings?.preApplicationEssayMaxLength,
    )
  } catch (error) {
    console.error("Failed to fetch essay length limits from database:", error)
    return {
      min: DEFAULT_ESSAY_MIN_LENGTH,
      max: DEFAULT_ESSAY_MAX_LENGTH,
    }
  }
}
