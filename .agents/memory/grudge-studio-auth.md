---
name: Grudge Studio auth integration
description: Non-obvious facts about integrating id.grudge-studio.com auth + ObjectStore data into the game
---

# Grudge Studio (id.grudge-studio.com) auth

- The current session endpoint is **`/api/auth/me`** (GET, cookie-authenticated). The published SDK's `getMe()` points at `/identity/me`, which does NOT work — it returns the SPA `text/html` page (200), not JSON.
  **Why:** a Cloudflare worker (`x-grudge-proxy: cf-worker`) fronts the domain and serves the gaming-portal SPA HTML for any unmatched path, so wrong API paths look like a "200" success but are actually HTML. Always check `content-type` is `application/json`, not just the status code, when probing their endpoints.
- Working JSON endpoints: `POST /api/auth/{guest,login,register}`, `GET /api/auth/me`.
- Auth = HttpOnly cookie `gs_player_session` (Domain=`.grudge-studio.com`, SameSite=None, Secure). Browser cross-origin calls are blocked (no ACAO for our origin) → MUST proxy through our api-server, which stores the upstream session value in our own signed HttpOnly cookie and re-attaches it as `Cookie: gs_player_session=...` on `/me`.
- Guest responses contain **no `token` field** — only the cookie. So Bearer-token auth (what the SDK uses for the game/account APIs) is not available for guest sessions; cookie forwarding is the reliable path.

# No password-reset / account-recovery endpoint
- id.grudge-studio.com exposes **no** password-reset / forgot-password endpoint. The SPA bundle (`/assets/index-*.js`, source of truth) lists every `/api/auth/*` path: guest, login, register, logout, me, lookup, complete-profile, allowed-origins, popup-token, session/exchange, puter-sso, phantom/{nonce,verify}, twilio/{start,verify}, and OAuth start for google/discord/github. None are reset/forgot/recover.
- Probing `/api/auth/{forgot-password,reset-password,recover,...}` returns SPA HTML (200 `text/html`), i.e. the route does not exist. Recovery upstream is only via OAuth or phone (Twilio), not email/password reset. A "Forgot password?" flow is therefore not buildable against this upstream.

# Login identifier handling
- `POST /api/auth/login` accepts an **email, username, OR Grudge ID** all under the single `username` field (the portal SPA labels its field "Email, username, or Grudge ID" and sends `{username, password}`). Do not invent `email`/`identifier` keys for upstream — it only reads `username`.
- Upstream login is **whitespace-sensitive**: a leading/trailing space on the identifier returns `401 {"error":"Invalid credentials"}`. The portal trims; always trim the identifier (client + proxy) before forwarding, or autofill/paste/mobile-keyboard spaces cause "works on the site, 401 in our app".
- `register`/`login` for an existing username/password account both work via the API and auto-set the `gs_player_session` cookie; the login contract field names are NOT the problem — input normalization (trim) is.

# OAuth (Google/Discord/GitHub) — popup + token-exchange
- Cross-origin cookie capture is impossible, so social login uses a **launch-token handoff**, not a redirect. Flow: open a popup at `id.grudge-studio.com/api/auth/<provider>/start?redirect=/auth/popup?audience=<our-origin>`. After provider auth the popup lands on `/auth/popup`, mints a short-lived token via `POST /api/auth/popup-token {audience}`, and `window.opener.postMessage({type:"grudge:auth:success", token, player}, audience)`. The opener exchanges it: `POST /api/auth/session/exchange {token, audience}`, which returns the player and a `gs_player_session` Set-Cookie — so route this through our proxy (reuse the same handler as guest/login) to land it in our `gw_grudge` cookie.
- The opener MUST validate `event.origin === "https://id.grudge-studio.com"`; popup also emits `grudge:auth:error` / `grudge:auth:cancel`.
- **Audience must be allowlisted upstream** (`/api/auth/allowed-origins`, env `AUTH_ALLOWED_ORIGINS`). Currently allowlisted: grudgeplatform.io, grudgewarlords.com, grudge-studio.com. Replit dev domains are NOT listed → popup shows "Origin … is not allowlisted" in dev; works from the production game origin.
- As of 2026-06, providers are **not configured upstream**: `GET /api/auth/<provider>/start` → `501 {"error":"Google OAuth not configured…"}`. Wiring is correct and will work once upstream sets the provider client IDs; `session/exchange` already responds (bad token → `Invalid or expired launch token`).

# ObjectStore data
- Public game data: `https://molochdagod.github.io/ObjectStore/api/v1/*.json` (CORS `*`, fetch directly from the browser, no proxy needed).
- Some datasets (e.g. materials) are a flat array under a top-level key instead of `categories` — normalize both shapes.
- Item objects include an `emoji` field; per project no-emoji rule, never render it.
