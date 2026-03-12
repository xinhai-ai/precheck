import { cookies } from "next/headers"
import type { NextResponse } from "next/server"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server"

type PasskeyUser = {
  id: string
  email: string
  name?: string | null
}

type StoredPasskeyCredential = {
  credentialID: string
  publicKey: Uint8Array | Buffer
  counter: bigint | number
  transports?: string[] | null
}

type PasskeySummaryRecord = {
  id: string
  credentialID: string
  deviceType: string
  backedUp: boolean
  transports: string[]
  createdAt: Date
  lastUsedAt: Date | null
}

type StoredPasskeyChallenge = {
  challenge: string
  userId?: string
  expiresAt: number
}

type PasskeyFlow = "register" | "authenticate"

const PASSKEY_CHALLENGE_MAX_AGE_SECONDS = 5 * 60
const PASSKEY_REGISTER_CHALLENGE_COOKIE = "passkey_register_challenge"
const PASSKEY_AUTHENTICATE_CHALLENGE_COOKIE = "passkey_authenticate_challenge"

const SUPPORTED_TRANSPORTS = new Set<AuthenticatorTransportFuture>([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
])

function getPasskeyCookieName(flow: PasskeyFlow) {
  return flow === "register"
    ? PASSKEY_REGISTER_CHALLENGE_COOKIE
    : PASSKEY_AUTHENTICATE_CHALLENGE_COOKIE
}

function getAppUrl() {
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!rawAppUrl) {
    return null
  }

  try {
    return new URL(rawAppUrl)
  } catch {
    return null
  }
}

export function isPasskeyConfigured() {
  return Boolean(getAppUrl())
}

export function getPasskeyExpectedOrigin() {
  return getAppUrl()?.origin ?? null
}

export function getPasskeyRpID() {
  return getAppUrl()?.hostname ?? null
}

export function getPasskeyRpName() {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || getAppUrl()?.hostname || "Precheck"
}

function encodeChallengeCookie(value: StoredPasskeyChallenge) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function decodeChallengeCookie(value?: string | null): StoredPasskeyChallenge | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as StoredPasskeyChallenge
    if (!parsed.challenge || typeof parsed.challenge !== "string") {
      return null
    }
    if (!parsed.expiresAt || typeof parsed.expiresAt !== "number") {
      return null
    }
    if (parsed.expiresAt <= Date.now()) {
      return null
    }
    if (parsed.userId && typeof parsed.userId !== "string") {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function setPasskeyChallengeCookie(
  response: NextResponse,
  flow: PasskeyFlow,
  challenge: string,
  userId?: string,
) {
  response.cookies.set(
    getPasskeyCookieName(flow),
    encodeChallengeCookie({
      challenge,
      userId,
      expiresAt: Date.now() + PASSKEY_CHALLENGE_MAX_AGE_SECONDS * 1000,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PASSKEY_CHALLENGE_MAX_AGE_SECONDS,
    },
  )
}

export function clearPasskeyChallengeCookie(response: NextResponse, flow: PasskeyFlow) {
  response.cookies.delete(getPasskeyCookieName(flow))
}

export async function getPasskeyChallenge(flow: PasskeyFlow) {
  const cookieStore = await cookies()
  return decodeChallengeCookie(cookieStore.get(getPasskeyCookieName(flow))?.value)
}

function toAuthenticatorTransports(
  transports?: string[] | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!transports?.length) {
    return undefined
  }

  const filtered = transports.filter(
    (transport): transport is AuthenticatorTransportFuture =>
      SUPPORTED_TRANSPORTS.has(transport as AuthenticatorTransportFuture),
  )

  return filtered.length > 0 ? filtered : undefined
}

export async function buildPasskeyRegistrationOptions(input: {
  user: PasskeyUser
  credentials: Array<Pick<StoredPasskeyCredential, "credentialID" | "transports">>
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const rpID = getPasskeyRpID()
  if (!rpID) {
    throw new Error("Passkey RP ID is not configured")
  }

  return generateRegistrationOptions({
    rpName: getPasskeyRpName(),
    rpID,
    userName: input.user.email,
    userID: new TextEncoder().encode(input.user.id),
    userDisplayName: input.user.name || input.user.email,
    excludeCredentials: input.credentials.map((credential) => ({
      id: credential.credentialID,
      transports: toAuthenticatorTransports(credential.transports),
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  })
}

export async function buildPasskeyAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const rpID = getPasskeyRpID()
  if (!rpID) {
    throw new Error("Passkey RP ID is not configured")
  }

  return generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  })
}

export async function verifyPasskeyRegistration(input: {
  credential: RegistrationResponseJSON
  expectedChallenge: string
}) {
  const expectedOrigin = getPasskeyExpectedOrigin()
  const expectedRPID = getPasskeyRpID()
  if (!expectedOrigin || !expectedRPID) {
    throw new Error("Passkey origin is not configured")
  }

  return verifyRegistrationResponse({
    response: input.credential,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin,
    expectedRPID,
  })
}

export async function verifyPasskeyAuthentication(input: {
  credential: AuthenticationResponseJSON
  expectedChallenge: string
  storedCredential: StoredPasskeyCredential
}) {
  const expectedOrigin = getPasskeyExpectedOrigin()
  const expectedRPID = getPasskeyRpID()
  if (!expectedOrigin || !expectedRPID) {
    throw new Error("Passkey origin is not configured")
  }

  const credential: WebAuthnCredential = {
    id: input.storedCredential.credentialID,
    publicKey: new Uint8Array(input.storedCredential.publicKey),
    counter:
      typeof input.storedCredential.counter === "bigint"
        ? Number(input.storedCredential.counter)
        : input.storedCredential.counter,
    transports: toAuthenticatorTransports(input.storedCredential.transports),
  }

  return verifyAuthenticationResponse({
    response: input.credential,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin,
    expectedRPID,
    credential,
  })
}

export function serializePasskeyCredential(record: PasskeySummaryRecord) {
  return {
    id: record.id,
    credentialIdSuffix: record.credentialID.slice(-8),
    deviceType: record.deviceType,
    backedUp: record.backedUp,
    transports: record.transports,
    createdAt: record.createdAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
  }
}
