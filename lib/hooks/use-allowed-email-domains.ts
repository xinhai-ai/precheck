"use client"

import { allowedEmailDomains } from "@/lib/pre-application/constants"
import { useEffect, useState } from "react"

const DEFAULT_DOMAINS = [...allowedEmailDomains]

type RegistrationEmailPolicy = {
  allowedDomains: string[]
  registerQqNumberEmailOnly: boolean
}

const DEFAULT_POLICY: RegistrationEmailPolicy = {
  allowedDomains: DEFAULT_DOMAINS,
  registerQqNumberEmailOnly: false,
}

let cachedPolicy: RegistrationEmailPolicy | null = null
let fetchingPromise: Promise<RegistrationEmailPolicy> | null = null

async function loadRegistrationEmailPolicy(): Promise<RegistrationEmailPolicy> {
  if (cachedPolicy) {
    return cachedPolicy
  }

  if (!fetchingPromise) {
    fetchingPromise = (async () => {
      try {
        const response = await fetch("/api/public/system-config", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to fetch system config")
        }

        const data = (await response.json()) as {
          allowedEmailDomains?: string[]
          registerQqNumberEmailOnly?: boolean
        }
        const allowedDomains =
          Array.isArray(data.allowedEmailDomains) && data.allowedEmailDomains.length > 0
            ? [...data.allowedEmailDomains]
            : [...DEFAULT_DOMAINS]

        cachedPolicy = {
          allowedDomains,
          registerQqNumberEmailOnly: data.registerQqNumberEmailOnly === true,
        }

        return cachedPolicy
      } catch (error) {
        console.error("Unable to load allowed email domains:", error)
        cachedPolicy = DEFAULT_POLICY
        return DEFAULT_POLICY
      } finally {
        fetchingPromise = null
      }
    })()
  }

  return fetchingPromise
}

export function useRegistrationEmailPolicy() {
  const [policy, setPolicy] = useState<RegistrationEmailPolicy>(cachedPolicy ?? DEFAULT_POLICY)

  useEffect(() => {
    let mounted = true

    loadRegistrationEmailPolicy().then((result) => {
      if (mounted) {
        setPolicy(result)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  return policy
}

export function useAllowedEmailDomains() {
  return useRegistrationEmailPolicy().allowedDomains
}
