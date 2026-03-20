export type FingerprintCollectionStatus = "OK" | "COLLECTION_FAILED"

export type FingerprintBrowserFamily = "SAFARI" | "CHROME" | "FIREFOX" | "EDGE" | "OTHER"

export type FingerprintPayload = {
  fingerprintVisitorId?: string
  fingerprintStatus: FingerprintCollectionStatus
  fingerprintFailureReason?: string
}

export type FingerprintEventType =
  | "LOGIN_PASSWORD"
  | "LOGIN_CODE"
  | "LOGIN_OAUTH"
  | "LOGIN_PASSKEY"
  | "PRE_APPLICATION_SUBMIT"
