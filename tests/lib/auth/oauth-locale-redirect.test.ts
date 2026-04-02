import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const githubAuthRouteSource = readFileSync(
  new URL("../../../app/api/auth/github/route.ts", import.meta.url),
  "utf8",
)
const googleAuthRouteSource = readFileSync(
  new URL("../../../app/api/auth/google/route.ts", import.meta.url),
  "utf8",
)
const linuxdoAuthRouteSource = readFileSync(
  new URL("../../../app/api/auth/linuxdo/route.ts", import.meta.url),
  "utf8",
)
const githubCallbackRouteSource = readFileSync(
  new URL("../../../app/api/auth/callback/github/route.ts", import.meta.url),
  "utf8",
)
const googleCallbackRouteSource = readFileSync(
  new URL("../../../app/api/auth/callback/google/route.ts", import.meta.url),
  "utf8",
)
const linuxdoCallbackRouteSource = readFileSync(
  new URL("../../../app/api/auth/callback/linuxdo/route.ts", import.meta.url),
  "utf8",
)
const oauthStateSource = readFileSync(
  new URL("../../../lib/auth/oauth-state.ts", import.meta.url),
  "utf8",
)

test("oauth state stores locale together with fingerprint context", () => {
  assert.match(oauthStateSource, /searchParams\.set\("locale", normalizedLocale\)/)
  assert.match(oauthStateSource, /searchParams\.set\("fp_ctx", trimmedFingerprintContextToken\)/)
  assert.match(oauthStateSource, /if \(state\?\.startsWith\("fp:"\)\)/)
  assert.match(
    oauthStateSource,
    /const locale = normalizeOAuthLocale\(searchParams\.get\("locale"\)\) \?\? defaultLocale/,
  )
})

test("oauth entry routes capture request locale before redirecting to providers", () => {
  for (const routeSource of [
    githubAuthRouteSource,
    googleAuthRouteSource,
    linuxdoAuthRouteSource,
  ]) {
    assert.match(routeSource, /resolveLocaleForRequest\(request\)/)
    assert.match(
      routeSource,
      /buildOAuthState\(\{\s*fingerprintContextToken:\s*fpCtx,\s*locale,\s*\}\)/,
    )
  }
})

test("oauth callback routes restore locale-specific login and dashboard redirects", () => {
  for (const routeSource of [
    githubCallbackRouteSource,
    googleCallbackRouteSource,
    linuxdoCallbackRouteSource,
  ]) {
    assert.match(
      routeSource,
      /const \{ fingerprintContextToken, locale \} = parseOAuthState\(state\)/,
    )
    assert.match(
      routeSource,
      /buildRedirectUrl\(`\/\$\{locale\}\/login\?error=no_code`, request\.url\)/,
    )
    assert.match(
      routeSource,
      /buildRedirectUrl\(`\/\$\{locale\}\/login\?error=oauth_failed`, request\.url\)/,
    )
    assert.match(routeSource, /buildRedirectUrl\(`\/\$\{locale\}\/dashboard`, request\.url\)/)
  }
})
