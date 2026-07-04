#!/usr/bin/env node
/**
 * Stage canonical VFX catalogs from info.grudge-studio.com for offline deploy.
 * Sources: vfx-skill-types, 3dfx-registry, spell-arsenal (grudge-vfx.puter.site).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data", "vfx");
const OBJECT_STORE = join(
  "C:",
  "Users",
  "nugye",
  "Documents",
  "1111111",
  "ObjectStore",
  "api",
  "v1",
);

const SOURCES = [
  { name: "vfx-skill-types.json", urls: ["https://info.grudge-studio.com/api/v1/vfx-skill-types.json"] },
  { name: "3dfx-registry.json", urls: ["https://info.grudge-studio.com/api/v1/3dfx-registry.json"] },
  {
    name: "spell-arsenal.json",
    urls: ["https://info.grudge-studio.com/api/v1/spell-arsenal.json"],
  },
];

mkdirSync(DATA, { recursive: true });

async function fetchOrCopy(name, urls) {
  const localOs = join(OBJECT_STORE, name);
  if (existsSync(localOs)) {
    copyFileSync(localOs, join(DATA, name));
    console.log(`[vfx] copied ObjectStore ${name}`);
    return;
  }
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      writeFileSync(join(DATA, name), text);
      console.log(`[vfx] fetched ${url}`);
      return;
    } catch {
      /* try next */
    }
  }
  const tmp = join(ROOT, `.tmp-${name}`);
  if (existsSync(tmp)) {
    copyFileSync(tmp, join(DATA, name));
    console.log(`[vfx] copied tmp ${name}`);
    return;
  }
  throw new Error(`[vfx] could not stage ${name}`);
}

for (const src of SOURCES) {
  await fetchOrCopy(src.name, src.urls);
}

// Compact runtime catalog embedded in bundle patches
const skillTypes = JSON.parse(readFileSync(join(DATA, "vfx-skill-types.json"), "utf8"));
const registry = JSON.parse(readFileSync(join(DATA, "3dfx-registry.json"), "utf8"));

const projectiles = {};
for (const fx of skillTypes.vfxTypes?.projectile?.effects ?? []) {
  const reg = registry.effects?.[fx.id];
  projectiles[fx.id] = {
    uuid: fx.uuid,
    element: fx.element,
    primary: reg?.colors?.primary ?? null,
    secondary: reg?.colors?.secondary ?? null,
    speed: reg?.timing?.speed ?? 1,
  };
}

const castAuras = {};
for (const fx of skillTypes.vfxTypes?.aura?.effects ?? []) {
  const reg = registry.effects?.[fx.id];
  if (!fx.id.includes("channeling") && fx.id !== "casting_fire") continue;
  castAuras[fx.id] = {
    element: fx.element,
    primary: reg?.colors?.primary ?? "#8844ff",
    secondary: reg?.colors?.secondary ?? "#cc88ff",
  };
}

const compact = {
  version: skillTypes.version,
  sandbox: "https://grudge-vfx.puter.site/",
  projectiles,
  castAuras,
  fxMap: {
    "fx.mage.firebolt": { proj: "flame_ball", cast: "casting_fire", element: "fire" },
    "fx.mage.arcane_shield": { proj: "chaos_orb", cast: "arcane_channeling", element: "arcane" },
    "fx.ranger.piercing_shot": { proj: "arrow_trail", cast: "light_channeling", element: "physical" },
    "fx.ranger.volley": { proj: "arrow_trail", cast: "light_channeling", element: "physical" },
    "fx.gun.burst": { proj: "wg_bullet", cast: "arcane_channeling", element: "physical" },
    "fx.warrior.cleave": { proj: null, cast: "casting_fire", element: "physical" },
    "fx.warrior.warcry": { proj: null, cast: "casting_fire", element: "physical" },
  },
  elementDefaults: {
    fire: { proj: "flame_ball", cast: "casting_fire", primary: "#ff4400", secondary: "#ffcc00" },
    frost: { proj: "ice_ball", cast: "arcane_channeling", primary: "#44ddff", secondary: "#ffffff" },
    lightning: { proj: "lightning_ball", cast: "light_channeling", primary: "#ffff44", secondary: "#aaddff" },
    arcane: { proj: "chaos_orb", cast: "arcane_channeling", primary: "#aa44ff", secondary: "#cc88ff" },
    holy: { proj: "cured_ball", cast: "light_channeling", primary: "#ffee44", secondary: "#ffffff" },
    physical: { proj: "arrow_trail", cast: "light_channeling", primary: "#e8c878", secondary: "#cdeac0" },
    shadow: { proj: "chaos_orb", cast: "arcane_channeling", primary: "#aa00ff", secondary: "#ff0066" },
  },
};

writeFileSync(join(DATA, "wg-vfx-catalog.json"), JSON.stringify(compact, null, 2) + "\n");
console.log("[vfx] wrote data/vfx/wg-vfx-catalog.json");