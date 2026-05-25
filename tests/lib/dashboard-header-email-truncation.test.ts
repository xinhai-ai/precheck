import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const dashboardHeaderSource = readFileSync(
  new URL("../../components/dashboard/header.tsx", import.meta.url),
  "utf8",
)

const dashboardProfileTriggerSource =
  dashboardHeaderSource.match(
    /<DropdownMenuTrigger asChild>[\s\S]*?<DropdownMenuContent align="end" className="w-56">/,
  )?.[0] ?? ""

test("dashboard header profile email has a visible width cap", () => {
  assert.match(dashboardProfileTriggerSource, /max-w-\[16rem\]/)
  assert.match(dashboardProfileTriggerSource, /min-w-0/)
  assert.match(dashboardProfileTriggerSource, /max-w-\[22ch\]/)
  assert.match(
    dashboardProfileTriggerSource,
    /<span className="truncate text-xs text-muted-foreground" title=\{user\.email\}>\s*\{user\.email\}\s*<\/span>/,
  )
})
