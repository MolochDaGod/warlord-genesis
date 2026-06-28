---
name: Puter primary auth
description: How Grudge Warlords authenticates — Puter as primary login, server-owned accounts, CSRF model.
---

# Puter-primary auth (Grudge Warlords)

Login is **Puter.js first**; the Grudge account is **server-owned** in Postgres (`grudge_users`), not Puter-owned. Puter only proves identity.

## Trust model
- Client gets a token from Puter (`window.puter.authToken`) and POSTs it to `/api/grudge/auth/puter`.
- Server is the only thing that verifies the token, against `GET https://api.puter.com/whoami` (Bearer). **Never trust client-asserted profile fields.**
- Identity is keyed **strictly on the Puter `uuid`**. Fail closed if `whoami` returns no uuid — do not fall back to username (it is mutable and can collide).
- **Why:** a username fallback lets identity drift / collide if Puter username semantics change; the uuid is the only stable key.

## whoami field assumption (unverified)
- The `whoami` response is assumed to expose `uuid` and `username`. This was **not** verifiable in the sandbox (no real Puter token, popup can't run headlessly). If real logins fail with "missing a stable uuid", re-check the actual `whoami` JSON shape first.

## CSRF / session-forcing defense
- Auth-mutating POSTs (`/puter`, `/guest`, `/logout`) require header `X-Grudge-Client: web`; server returns 403 without it.
- Session cookie (`gw_grudge`, signed, httpOnly) is `sameSite=lax`, so it is not sent on cross-site requests.
- **Why:** a cross-site HTML form cannot set a custom header, and cross-site fetch can't read the lax cookie — together this blocks an attacker forcing a victim into a chosen account. Client must send this header on all auth POSTs.

## DB write pattern
- Both Puter and guest auth use a single atomic upsert (`onConflictDoUpdate` on the unique key: `puter_uuid` / `device_id`) + `.returning()` — never select-then-insert.
- **Why:** select-then-insert races on concurrent first logins and 500s on the unique constraint.
- `isNew` is derived as `row.createdAt.getTime() === row.updatedAt.getTime()` (a fresh insert has equal timestamps; a conflict update bumps `updatedAt`).
