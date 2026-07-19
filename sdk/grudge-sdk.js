/**
 * Same-origin Grudge SDK shim for Warlord Genesis.
 * Replaces missing objectstore.grudge-studio.com/sdk/grudge-sdk.js (404 / ERR_CONNECTION_CLOSED).
 *
 * Canonical fleet integration:
 *   - https://grudge-warlords.github.io/grudge-dev-tool/api-reference.html
 *   - @grudge-studio/sdk / @grudge-studio/core (npm)
 *   - forge.grudge-studio.com (editor deploy surface)
 */
const TOKEN_KEYS = ["grudge_auth_token", "grudge_session_token", "grudge.token", "sso_token"];

function readToken() {
  try {
    for (const k of TOKEN_KEYS) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function api(pathName, token, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", "Bearer " + token);
  headers.set("X-Grudge-Client", "warlord-genesis");
  const res = await fetch(pathName, { ...init, headers, credentials: "same-origin" });
  if (!res.ok) {
    const err = new Error("HTTP " + res.status);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export class GrudgeSDK {
  constructor(opts = {}) {
    this.token = opts.token || readToken();
    this.base = opts.base || "";
    const tok = () => this.token || readToken();
    this.auth = {
      getMe: async () => {
        const token = tok();
        if (!token) throw new Error("Not authenticated");
        try {
          return await api(this.base + "/api/auth/me", token);
        } catch {
          return await api(this.base + "/api/auth/scoped-profile", token);
        }
      },
      getToken: () => tok(),
    };
    this.account = {
      get: async () => api(this.base + "/api/account", tok()),
      resources: async () => api(this.base + "/api/account/resources", tok()),
    };
    this.characters = {
      list: async () => api(this.base + "/api/characters", tok()),
    };
  }
}

export default GrudgeSDK;

if (typeof window !== "undefined") {
  window.GrudgeSDK = GrudgeSDK;
}
