/**
 * Fix missing ObjectStore grudge-sdk (404) + global CSS body pollution (ugly layout).
 * Run: node scripts/fix-sdk-and-shell.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const SDK = `/**
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
`;

const POLISH = `
/* === GW shell fix 2026-07 — neutralize unscoped body layout dumps + polish === */
html{height:100%!important;width:100%!important;margin:0!important;padding:0!important;background:#0a0f18!important;color-scheme:dark}
html,body,#root{height:100%!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;box-sizing:border-box}
body{display:block!important;grid-template-columns:none!important;grid-template-rows:none!important;gap:0!important;align-items:stretch!important;flex-direction:row!important;overflow:hidden!important;background:#0a0f18!important;font-family:Inter,system-ui,sans-serif!important;color:#f3dcc4}
#root{display:block!important;position:relative!important;min-height:100%!important;isolation:isolate}
.gw-root{position:fixed!important;inset:0!important;overflow:hidden!important;background:radial-gradient(ellipse 100% 70% at 50% -10%,rgba(192,57,43,.14),transparent 55%),linear-gradient(180deg,#120c0a 0%,#0a0f18 50%,#08060a 100%)!important;font-family:"EB Garamond",Georgia,serif!important;color:var(--gk-ink,#f3dcc4)!important;-webkit-font-smoothing:antialiased}
.gw-screen{min-height:100%!important;width:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:clamp(16px,3vw,40px)!important;box-sizing:border-box}
.gw-btn,.gw-auth-btn,button.gw-btn{appearance:none;border-radius:10px!important;border:1px solid rgba(224,178,82,.4)!important;background:linear-gradient(180deg,rgba(192,57,43,.9),rgba(120,30,20,.95))!important;color:#f8e8d0!important;font-family:Cinzel,serif!important;font-weight:600!important;letter-spacing:.06em!important;padding:10px 18px!important;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.35);transition:transform .12s ease,box-shadow .12s ease,border-color .12s}
.gw-btn:hover,button.gw-btn:hover{transform:translateY(-1px);border-color:rgba(224,178,82,.75)!important;box-shadow:0 8px 24px rgba(192,57,43,.25)}
.gw-btn-ghost{background:rgba(14,20,32,.75)!important;border-color:rgba(120,150,200,.3)!important}
.gw-hint,.gw-muted{color:var(--gk-muted,#b89a7c)!important}
.gw-play-gate-panel,.gw-play-boot-inner,.gw-auth-bar,.wg-pregame-board,.gw-lobby-panel{backdrop-filter:blur(10px);background:rgba(12,10,12,.72)!important;border:1px solid rgba(224,178,82,.22)!important;border-radius:14px!important;box-shadow:0 16px 48px rgba(0,0,0,.45)}
h1,h2,.gw-play-gate-title,.gw-lobby-title{font-family:Cinzel Decorative,Cinzel,serif!important;font-weight:700!important;letter-spacing:.04em;color:#f8e4c4!important;text-shadow:0 2px 12px rgba(0,0,0,.5)}
a{color:#e0b252}
body>aside,body>.sidebar{display:none!important}
`;

const OLD_SDK = "https://objectstore.grudge-studio.com/sdk/grudge-sdk.js";
const NEW_SDK = "/sdk/grudge-sdk.js";

// Write SDK to all public roots
for (const rel of ["sdk/grudge-sdk.js", "assets/sdk/grudge-sdk.js"]) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, SDK);
  console.log("wrote", rel);
}

// Patch bundles
for (const rel of [
  "assets/index-warlord-fix2.js",
  "assets/gw-core-20260713.js",
  "assets/index-warlord-fix95.js",
  "assets/index-warlord-fix3.js",
]) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  let t = fs.readFileSync(p, "utf8");
  if (t.includes(OLD_SDK)) {
    fs.writeFileSync(p, t.split(OLD_SDK).join(NEW_SDK));
    console.log("sdk url patched", rel);
  } else if (t.includes(NEW_SDK)) {
    console.log("sdk already local", rel);
  } else {
    console.log("no sdk string", rel);
  }
}

// CSS polish
const cssPath = path.join(ROOT, "assets/index-BNWYZMT1.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* === GW shell fix 2026-07";
if (css.includes(marker)) {
  css = css.slice(0, css.indexOf(marker)) + POLISH;
} else {
  css = css + "\n" + POLISH;
}
fs.writeFileSync(cssPath, css);
console.log("css polished", css.length);

// patch-bundle permanent rewrite
const pb = path.join(ROOT, "scripts/patch-bundle.mjs");
let pbs = fs.readFileSync(pb, "utf8");
if (!pbs.includes("/* sdk-url-v1 */")) {
  const anchor = "manifest.lastBuilt = new Date().toISOString();";
  if (pbs.includes(anchor)) {
    pbs = pbs.replace(
      anchor,
      `// /* sdk-url-v1 */ never load missing ObjectStore SDK (404 / ERR_CONNECTION_CLOSED)
js = js.replaceAll(
  "https://objectstore.grudge-studio.com/sdk/grudge-sdk.js",
  "/sdk/grudge-sdk.js",
);
js = js.replaceAll(
  "https://assets.grudge-studio.com/sdk/grudge-sdk.js",
  "/sdk/grudge-sdk.js",
);
${anchor}`,
    );
    fs.writeFileSync(pb, pbs);
    console.log("patch-bundle sdk rewrite added");
  }
}

// index.html
let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
html = html.replace(/\?h=b\d+/g, "?h=b23");
if (!html.includes('href="/sdk/grudge-sdk.js"')) {
  html = html.replace(
    "</head>",
    `    <link rel="modulepreload" href="/sdk/grudge-sdk.js?h=b23" />
    <link rel="preconnect" href="https://assets.grudge-studio.com" crossorigin />
  </head>`,
  );
}
fs.writeFileSync(path.join(ROOT, "index.html"), html);
console.log("index cache bust b23");

// vercel.json — headers + SPA exclude sdk
const vjPath = path.join(ROOT, "vercel.json");
const vj = JSON.parse(fs.readFileSync(vjPath, "utf8"));
if (!Array.isArray(vj.headers)) vj.headers = [];
vj.headers = vj.headers.filter((h) => !String(h.source).includes("/sdk/"));
vj.headers.unshift({
  source: "/sdk/(.*).js",
  headers: [
    { key: "Content-Type", value: "application/javascript; charset=utf-8" },
    { key: "Cache-Control", value: "public, max-age=300" },
    { key: "Access-Control-Allow-Origin", value: "*" },
  ],
});
if (Array.isArray(vj.rewrites)) {
  for (const r of vj.rewrites) {
    if (typeof r.source === "string" && r.source.includes("(?!") && !r.source.includes("sdk")) {
      r.source = r.source.replace("anims/", "anims/|sdk/|");
      if (!r.source.includes("sdk")) {
        r.source =
          "/((?!assets/|models/|media/|textures/|anims/|sdk/|api/|favicon\\.svg|auth-bg|grudge-id-logo|brand/|grudge-game-bootstrap).*)";
      }
    }
  }
}
fs.writeFileSync(vjPath, JSON.stringify(vj, null, 2) + "\n");
console.log("vercel.json updated");

// generate-vercel-config exclude
const gen = path.join(ROOT, "scripts/generate-vercel-config.mjs");
if (fs.existsSync(gen)) {
  let g = fs.readFileSync(gen, "utf8");
  if (g.includes("anims/") && !g.includes("sdk/")) {
    fs.writeFileSync(gen, g.replaceAll("anims/", "anims/|sdk/|"));
    console.log("generate-vercel-config excludes sdk");
  }
}

console.log("OK");
