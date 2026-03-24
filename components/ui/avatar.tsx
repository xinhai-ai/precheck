"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { useAvatarAllowlist } from "@/components/ui/avatar-allowlist-provider"
import { getSafeAvatarUrl } from "@/lib/avatar-url"
import { cn } from "@/lib/utils"

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  src,
  ...restProps
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  const allowedAvatarDomains = useAvatarAllowlist()
  const safeSrc = typeof src === "string" ? getSafeAvatarUrl(src, allowedAvatarDomains) : undefined

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      src={safeSrc}
      {...restProps}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("bg-muted flex size-full items-center justify-center rounded-full", className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
