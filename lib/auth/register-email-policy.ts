export const QQ_NUMBER_EMAIL_DOMAIN = "qq.com"

const QQ_NUMBER_RE = /^\d+$/

export function isRegisterQqEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const [localPart, ...domainParts] = normalized.split("@")
  const domain = domainParts.join("@")

  return QQ_NUMBER_RE.test(localPart ?? "") && domain === QQ_NUMBER_EMAIL_DOMAIN
}

export function buildRegisterQqEmail(qqNumber: string): string {
  const normalizedQqNumber = qqNumber.replace(/\D/g, "")
  return normalizedQqNumber ? `${normalizedQqNumber}@${QQ_NUMBER_EMAIL_DOMAIN}` : ""
}
