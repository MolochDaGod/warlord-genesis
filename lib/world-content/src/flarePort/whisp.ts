/**
 * Whisp companions & collectibles — Warlords Era islands.
 *
 * In Grudge economy, whisps are elemental essences (icons under items/whisps).
 * In Flare-Boss / 3D islands they also act as floating companions that:
 *  - orbit the player after rescue
 *  - mark mission objectives
 *  - drop as bag items (account-scoped collect)
 */

export type WhispElement = "nature" | "arcane" | "frost" | "fire" | "void";

export interface WhispDef {
  id: string;
  name: string;
  element: WhispElement;
  /** Item id when bagged (account inventory) */
  itemId: string;
  color: number;
  emissive: number;
  /** Preferred sector spawn weights */
  sectorIds: string[];
  /** Optional mesh; null → procedural sprite orb (Three.js) */
  glb?: string | null;
  radius: number;
  bobSpeed: number;
  orbitRadius: number;
  xpOnCollect: number;
  goldOnCollect: number;
  description: string;
}

export const WHISP_DEFS: WhispDef[] = [
  {
    id: "whisp_green",
    name: "Nature Whisp",
    element: "nature",
    itemId: "whisp_green",
    color: 0x4ade80,
    emissive: 0x22c55e,
    sectorIds: ["n", "ne", "c", "e"],
    glb: null,
    radius: 0.35,
    bobSpeed: 2.2,
    orbitRadius: 1.4,
    xpOnCollect: 15,
    goldOnCollect: 5,
    description: "A gentle forest spirit. Follows captains who free it from thorn cages.",
  },
  {
    id: "whisp_blue",
    name: "Frost Whisp",
    element: "frost",
    itemId: "whisp_blue",
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    sectorIds: ["nw", "n", "w"],
    glb: null,
    radius: 0.32,
    bobSpeed: 2.6,
    orbitRadius: 1.5,
    xpOnCollect: 18,
    goldOnCollect: 6,
    description: "Crystalline cold. Guides travelers through Frozen Expanse fog.",
  },
  {
    id: "whisp_purple",
    name: "Arcane Whisp",
    element: "arcane",
    itemId: "whisp_purple",
    color: 0xa855f7,
    emissive: 0x7c3aed,
    sectorIds: ["e", "ne", "c"],
    glb: null,
    radius: 0.38,
    bobSpeed: 2.0,
    orbitRadius: 1.6,
    xpOnCollect: 25,
    goldOnCollect: 10,
    description: "Void-touched arcane mote. Dark elves cage these under the canopy.",
  },
  {
    id: "whisp_red",
    name: "Ember Whisp",
    element: "fire",
    itemId: "whisp_red",
    color: 0xf97316,
    emissive: 0xea580c,
    sectorIds: ["s", "sw", "se"],
    glb: null,
    radius: 0.34,
    bobSpeed: 2.8,
    orbitRadius: 1.35,
    xpOnCollect: 20,
    goldOnCollect: 8,
    description: "Born near Hellmaw vents. Lights dungeon corridors when bound.",
  },
];

export const WHISP_BY_ID = Object.fromEntries(
  WHISP_DEFS.map((w) => [w.id, w]),
) as Record<string, WhispDef>;

export type WhispRuntimeState =
  | "wild"
  | "caged"
  | "following"
  | "bagged"
  | "spent";

export interface WhispInstance {
  instanceId: string;
  defId: string;
  state: WhispRuntimeState;
  /** World position when wild/caged */
  position: [number, number, number];
  sectorId: string;
  /** Island id or home-island / instance id */
  siteId: string;
  /** If following a character UUID */
  ownerCharacterId?: string;
}

/** Spawn table for a sector (deterministic-friendly weights). */
export function whispsForSector(sectorId: string): WhispDef[] {
  return WHISP_DEFS.filter((w) => w.sectorIds.includes(sectorId));
}

/** Icon path contract (CDN when available; local fallback). */
export function whispIconUrl(defId: string): string {
  const id = defId.replace(/^whisp_/, "");
  return `https://assets.grudge-studio.com/icons/items/whisps/whisp_${id}.png`;
}

/**
 * Companion behavior script (data-driven; engine executes each tick).
 * Ported from Flare-style AI hooks — no Three dependency here.
 */
export interface WhispBehaviorTick {
  type: "orbit" | "lead_to" | "flee" | "idle_bob";
  target?: [number, number, number];
  speed: number;
}

export function whispBehavior(
  inst: WhispInstance,
  playerPos: [number, number, number] | null,
): WhispBehaviorTick {
  const def = WHISP_BY_ID[inst.defId];
  if (!def) return { type: "idle_bob", speed: 1 };

  if (inst.state === "caged") {
    return { type: "idle_bob", speed: def.bobSpeed * 0.4 };
  }
  if (inst.state === "following" && playerPos) {
    return {
      type: "orbit",
      target: playerPos,
      speed: def.bobSpeed,
    };
  }
  if (inst.state === "wild" && playerPos) {
    const dx = playerPos[0] - inst.position[0];
    const dz = playerPos[2] - inst.position[2];
    const dist = Math.hypot(dx, dz);
    if (dist < 4) return { type: "flee", target: playerPos, speed: def.bobSpeed * 1.5 };
  }
  return { type: "idle_bob", speed: def.bobSpeed };
}
