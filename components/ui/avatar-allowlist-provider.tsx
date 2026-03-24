"use client"

import { createContext, useContext } from "react"

const AvatarAllowlistContext = createContext<string[]>([])

export function AvatarAllowlistProvider({
  allowedAvatarDomains,
  children,
}: {
  allowedAvatarDomains: string[]
  children: React.ReactNode
}) {
  return (
    <AvatarAllowlistContext.Provider value={allowedAvatarDomains}>
      {children}
    </AvatarAllowlistContext.Provider>
  )
}

export function useAvatarAllowlist(): string[] {
  return useContext(AvatarAllowlistContext)
}
