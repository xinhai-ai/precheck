import type { Role } from "@prisma/client"

export type Capability =
  | "preApplication.review"
  | "preApplication.archive"
  | "preApplicationAppeal.view"
  | "preApplicationAppeal.review"

export type CapabilityActor = {
  role?: Role | null
}

const ROLE_CAPABILITIES = {
  USER: [],
  ADMIN: [
    "preApplication.review",
    "preApplication.archive",
    "preApplicationAppeal.view",
    "preApplicationAppeal.review",
  ],
  SUPER_ADMIN: [
    "preApplication.archive",
    "preApplicationAppeal.view",
    "preApplicationAppeal.review",
  ],
} satisfies Record<Role, readonly Capability[]>

export function getCapabilitiesForRole(role: Role | null | undefined): Capability[] {
  if (!role) return []
  return [...ROLE_CAPABILITIES[role]]
}

export function hasCapability(
  roleOrActor: Role | CapabilityActor | null | undefined,
  capability: Capability,
): boolean {
  const role =
    typeof roleOrActor === "string" || roleOrActor === null || roleOrActor === undefined
      ? roleOrActor
      : roleOrActor.role

  return getCapabilitiesForRole(role).includes(capability)
}
