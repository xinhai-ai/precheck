export type FingerprintCollectionStatus = "OK" | "COLLECTION_FAILED"

export type FingerprintPayload = {
  fingerprintVisitorId?: string
  fingerprintStatus: FingerprintCollectionStatus
  fingerprintFailureReason?: string
}

export type FingerprintEventType =
  | "LOGIN_PASSWORD"
  | "LOGIN_CODE"
  | "LOGIN_OAUTH"
  | "PRE_APPLICATION_SUBMIT"

