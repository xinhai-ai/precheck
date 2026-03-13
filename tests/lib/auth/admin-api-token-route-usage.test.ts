import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const repoRoot = new URL("../../../", import.meta.url)
const apiRoot = path.join(repoRoot.pathname, "app/api")
const sessionSource = readFileSync(path.join(repoRoot.pathname, "lib/auth/session.ts"), "utf8")
const healthRouteSource = readFileSync(path.join(repoRoot.pathname, "app/api/health/route.ts"), "utf8")

function collectRouteFiles(dir: string): string[] {
  const files: string[] = []

  function walk(currentDir: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(entryPath)
        continue
      }

      if (entry.isFile() && entry.name === "route.ts") {
        files.push(entryPath)
      }
    }
  }

  walk(dir)
  return files.sort()
}

test("api routes read user from request to support bearer tokens", () => {
  const routeFiles = collectRouteFiles(apiRoot)
  assert.ok(routeFiles.length > 0, "expected api route files")

  const offenders = routeFiles
    .map((filePath) => ({
      filePath: path.relative(repoRoot.pathname, filePath).replace(/\\/g, "/"),
      source: readFileSync(filePath, "utf8"),
    }))
    .filter(({ source }) => {
      return /\bgetCurrentUser\s*\(/.test(source)
    })
    .map(({ filePath }) => filePath)

  assert.deepEqual(offenders, [], `api token auth drift detected: ${offenders.join(", ") || "none"}`)
})

test("health route uses request auth for admin detail visibility", () => {
  assert.match(healthRouteSource, /getCurrentUserFromRequest\(request\)/)
  assert.doesNotMatch(healthRouteSource, /getSession\(\)/)
})

test("expired session cleanup is idempotent", () => {
  assert.match(sessionSource, /await prisma\.session\.deleteMany\(\{\s*where:\s*\{\s*id:\s*session\.id\s*\}\s*\}\)/)
  assert.doesNotMatch(sessionSource, /await prisma\.session\.delete\(\{\s*where:\s*\{\s*id:\s*session\.id\s*\}\s*\}\)/)
})
