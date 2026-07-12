/**
 * Runtime capability / dependency preflight for Warlord Genesis /play.
 *
 * Browser runtime needs WebGL (required), WASM (Rapier), workers, pointer lock.
 * Node is a **build** dependency only — not required in the browser.
 * WebGPU is optional (future renderer path).
 */

import { detectWebGL, type WebGLSupport } from "./webgl";

export type CapabilitySeverity = "required" | "recommended" | "optional" | "build";

export interface CapabilityCheck {
  id: string;
  label: string;
  severity: CapabilitySeverity;
  ok: boolean;
  detail: string;
  /** What depends on this capability */
  requiresFor: string;
}

export interface CapabilityReport {
  ok: boolean;
  webgl: WebGLSupport;
  webgpu: boolean;
  checks: CapabilityCheck[];
  /** Human-readable blockers (required checks that failed). */
  blockers: string[];
}

function hasWebGPU(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined";
}

function hasWasm(): boolean {
  try {
    if (typeof WebAssembly === "undefined") return false;
    // Minimal module validation
    const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
    return WebAssembly.validate(bytes);
  } catch {
    return false;
  }
}

function hasWorkers(): boolean {
  return typeof Worker !== "undefined";
}

function hasPointerLock(): boolean {
  return (
    typeof document !== "undefined" &&
    ("pointerLockElement" in document ||
      "mozPointerLockElement" in document ||
      typeof (HTMLElement.prototype as { requestPointerLock?: unknown }).requestPointerLock ===
        "function")
  );
}

function hasLocalStorage(): boolean {
  try {
    const k = "__gw_cap_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function hasAudio(): boolean {
  return (
    typeof AudioContext !== "undefined" ||
    typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !==
      "undefined"
  );
}

function esModulesOk(): boolean {
  return typeof document !== "undefined" && "noModule" in HTMLScriptElement.prototype;
}

/**
 * Full preflight. Safe to call once at /play boot.
 * `ok` is false only when a **required** browser capability is missing.
 */
export function runCapabilityPreflight(): CapabilityReport {
  const webgl = detectWebGL();
  const webgpu = hasWebGPU();
  const wasm = hasWasm();
  const workers = hasWorkers();
  const pointerLock = hasPointerLock();
  const storage = hasLocalStorage();
  const idb = hasIndexedDB();
  const audio = hasAudio();
  const esm = esModulesOk();

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "n/a";
  const isSecure =
    typeof window !== "undefined" &&
    (window.isSecureContext || location.protocol === "https:" || location.hostname === "localhost");

  const checks: CapabilityCheck[] = [
    {
      id: "webgl",
      label: "WebGL / WebGL2",
      severity: "required",
      ok: webgl.ok,
      detail: webgl.ok ? "Context available" : webgl.reason || "Unavailable",
      requiresFor: "Three.js canvas, arena lighting, meshes",
    },
    {
      id: "wasm",
      label: "WebAssembly",
      severity: "required",
      ok: wasm,
      detail: wasm ? "WASM validated" : "WebAssembly missing",
      requiresFor: "@react-three/rapier heightfield terrain + hero CCD capsule",
    },
    {
      id: "es-modules",
      label: "ES Modules",
      severity: "required",
      ok: esm,
      detail: esm ? "Module scripts supported" : "Browser too old for ESM",
      requiresFor: "Vite production bundles",
    },
    {
      id: "secure-context",
      label: "Secure context (HTTPS)",
      severity: "required",
      ok: isSecure,
      detail: isSecure ? "Secure context" : "Need HTTPS or localhost",
      requiresFor: "Pointer lock, some storage APIs, future WebGPU",
    },
    {
      id: "workers",
      label: "Web Workers",
      severity: "recommended",
      ok: workers,
      detail: workers ? "Worker available" : "No Worker — heavier main thread",
      requiresFor: "Physics offload / asset pipelines",
    },
    {
      id: "pointer-lock",
      label: "Pointer Lock",
      severity: "recommended",
      ok: pointerLock,
      detail: pointerLock ? "Mouse lock API present" : "No pointer lock — combat look limited",
      requiresFor: "FPS mouse look on the field",
    },
    {
      id: "localStorage",
      label: "localStorage",
      severity: "recommended",
      ok: storage,
      detail: storage ? "Persist roster/meta" : "Private mode may wipe progress",
      requiresFor: "Roster, gear, meta progression",
    },
    {
      id: "indexeddb",
      label: "IndexedDB",
      severity: "optional",
      ok: idb,
      detail: idb ? "Available" : "Missing",
      requiresFor: "Large asset caches (optional)",
    },
    {
      id: "audio",
      label: "Web Audio",
      severity: "optional",
      ok: audio,
      detail: audio ? "AudioContext available" : "No audio API",
      requiresFor: "SFX / BGM",
    },
    {
      id: "webgpu",
      label: "WebGPU",
      severity: "optional",
      ok: webgpu,
      detail: webgpu
        ? "navigator.gpu present (optional advanced path)"
        : "Not available — WebGL renderer used",
      requiresFor: "Future high-end renderer (not required for /play)",
    },
    {
      id: "node",
      label: "Node.js ≥ 20",
      severity: "build",
      ok: true,
      detail: "Build/deploy only (pnpm). Not needed in browser.",
      requiresFor: "pnpm build, typecheck, Vercel CI",
    },
    {
      id: "pnpm",
      label: "pnpm 9.x",
      severity: "build",
      ok: true,
      detail: "Monorepo package manager (preinstall enforced).",
      requiresFor: "Workspace packages: game-content, grudge-engine, r3f-fleet, rapier, three",
    },
  ];

  const blockers = checks
    .filter((c) => c.severity === "required" && !c.ok)
    .map((c) => `${c.label}: ${c.detail}`);

  // Soft-log environment for support
  if (typeof console !== "undefined") {
    console.info("[warlord-genesis] capability preflight", {
      ua,
      ok: blockers.length === 0,
      webgl: webgl.ok,
      webgpu,
      wasm,
      blockers,
    });
  }

  return {
    ok: blockers.length === 0,
    webgl,
    webgpu,
    checks,
    blockers,
  };
}

/** Package dependency tree (document / UI) — browser does not install these. */
export const RUNTIME_DEPENDENCY_TREE = [
  {
    name: "react + react-dom + react-router-dom",
    role: "UI shell, /play routing",
    pre: ["ES modules", "modern browser"],
  },
  {
    name: "three + @react-three/fiber + @react-three/drei",
    role: "3D scene graph",
    pre: ["WebGL or WebGL2"],
  },
  {
    name: "@react-three/rapier (+ rapier WASM)",
    role: "Hero physics / colliders",
    pre: ["WebAssembly", "Web Workers (recommended)"],
  },
  {
    name: "zustand",
    role: "Game / roster / meta stores",
    pre: ["localStorage (recommended)"],
  },
  {
    name: "@workspace/game-content",
    role: "Prefabs, skills, class trees",
    pre: ["bundled at build"],
  },
  {
    name: "@workspace/grudge-engine",
    role: "CDN boot + terrain helpers",
    pre: ["fetch", "assets CDN"],
  },
  {
    name: "@workspace/r3f-fleet",
    role: "Canvas props + WebGL context guard",
    pre: ["WebGL"],
  },
  {
    name: "ObjectStore JSON (objectstore.grudge-studio.com)",
    role: "Weapons/armor codex for loadout",
    pre: ["network", "HTTPS"],
  },
  {
    name: "id.grudge-studio.com bootstrap (optional SSO)",
    role: "Auth handoff",
    pre: ["network"],
  },
] as const;

export const BUILD_DEPENDENCY_TREE = [
  { name: "Node.js ≥ 20", role: "Runtime for pnpm / Vite / tsc" },
  { name: "pnpm ≥ 9", role: "Workspace installs (enforced by preinstall)" },
  { name: "TypeScript ~5.9", role: "typecheck" },
  { name: "Vite", role: "Client bundle → artifacts/grudge-warlords" },
  { name: "Vercel", role: "Hosting warlord-genesis.vercel.app + warstrat.grudge-studio.com" },
] as const;
