export type FingerprintCollectionStatus = "OK" | "COLLECTION_FAILED"

export type FingerprintBrowserFamily = "SAFARI" | "CHROME" | "FIREFOX" | "EDGE" | "OTHER"

export type FingerprintComponentPrimitive = string | number | boolean | null

export type FingerprintComponentValue =
  | FingerprintComponentPrimitive
  | FingerprintComponentPrimitive[]
  | Record<string, FingerprintComponentPrimitive | FingerprintComponentPrimitive[]>

export type FingerprintComponents = Record<string, Record<string, FingerprintComponentValue>>

export type FingerprintSummary = {
  browser?: string
  platform?: string
  timezone?: string
  languages?: string[]
  screen?: string
  webgl?: string
  canvasPresent?: boolean
  hardware?: string
}

export type FingerprintSimilaritySignals = {
  matched: string[]
  different: string[]
  strong: string[]
  comparedEventId?: string | null
  comparedFingerprintHash?: string | null
}

export type FingerprintPayload = {
  fingerprintVisitorId?: string
  fingerprintComponents?: FingerprintComponents
  fingerprintStatus: FingerprintCollectionStatus
  fingerprintFailureReason?: string
}

export type FingerprintEventType =
  | "LOGIN_PASSWORD"
  | "LOGIN_CODE"
  | "LOGIN_OAUTH"
  | "LOGIN_PASSKEY"
  | "PRE_APPLICATION_SUBMIT"
