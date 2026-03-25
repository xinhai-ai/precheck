"use client"

import { normalizeSafeRichTextHtml } from "@/lib/safe-rich-text"
import { cn } from "@/lib/utils"

interface PostContentProps {
  content?: string | null
  className?: string
  emptyMessage?: string
}

export function PostContent({ content, className, emptyMessage }: PostContentProps) {
  const html = normalizeSafeRichTextHtml(content)

  if (!html) {
    if (!emptyMessage) return null
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div
      className={cn("prose prose-sm max-w-none break-words dark:prose-invert", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
