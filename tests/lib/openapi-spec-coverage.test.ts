import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const repoRoot = new URL("../../", import.meta.url)
const apiRoot = path.join(repoRoot.pathname, "app/api")
const specPath = path.join(repoRoot.pathname, "lib/openapi-spec.ts")

function collectRoutePaths(dir: string): string[] {
  const paths: string[] = []

  function walk(currentDir: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(entryPath)
        continue
      }

      if (entry.isFile() && entry.name === "route.ts") {
        const relativePath = path.relative(apiRoot, entryPath)
        const normalized = `/${relativePath
          .replace(/\\/g, "/")
          .replace(/\/route\.ts$/, "")
          .replace(/\[(.+?)\]/g, "{$1}")}`
        paths.push(normalized)
      }
    }
  }

  walk(dir)
  return paths.sort()
}

function collectSpecPaths(specSource: string): string[] {
  return [...specSource.matchAll(/^\s*"(\/[^\"]+)":\s*\{/gm)]
    .map((match) => match[1])
    .sort()
}

test("openapi spec covers every app/api route path", () => {
  const specSource = readFileSync(specPath, "utf8")
  const routePaths = collectRoutePaths(apiRoot)
  const specPaths = collectSpecPaths(specSource)
  const specPathSet = new Set(specPaths)
  const routePathSet = new Set(routePaths)

  const missing = routePaths.filter((routePath) => !specPathSet.has(routePath))
  const extra = specPaths.filter((specRoutePath) => !routePathSet.has(specRoutePath))

  assert.deepEqual(
    { missing, extra },
    { missing: [], extra: [] },
    `OpenAPI path drift detected. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}`,
  )
})
