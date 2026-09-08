/** Player deploy kits. Cap: 2 towers + 1 barrier + 3 traps. */
import type { ProjectileModel, ShopItem, StructureKind } from "../game/config";

export type DeployCategory = "aoe" | "bolt" | "magic" | "engineering" | "trap" | "support" | "barrier";
export type DeployKitId =
  | "defence_tower" | "squire_cannon" | "howitzer"
  | "railgun" | "fire_tower" | "helltower" | "missile" | "crystal"
  | "jumper" | "spikes" | "tesla" | "barrier";
export type DeployTab = "aoe" | "magic" | "bolt" | "trap";
export type TrapMode = "jumper" | "spikes" | "tesla";

export interface TrapProfile {
  mode: TrapMode;
  armRadius: number;
  effectRadius: number;
  damage: number;
  stun?: number;
  slowFactor?: number;
  slowDuration?: number;
  activeDuration?: number;
  tick?: number;
}
export interface DeployKit {
  id: DeployKitId; name: string; category: DeployCategory; file: string;
  kind: StructureKind; cost: number; description: string;
  splashRadius?: number; projectile?: ProjectileModel; trap?: TrapProfile;
}

const LOCAL = import.meta.env.BASE_URL;

export const DEPLOY_KITS: Record<DeployKitId, DeployKit> = {
  defence_tower: { id: "defence_tower", name: "Defence Tower", category: "aoe", file: "defence_tower.glb", kind: "cannon", cost: 130, description: "Roof-cannon keep. AoE shells.", splashRadius: 4.2, projectile: "cannon" },
  squire_cannon: { id: "squire_cannon", name: "Squire Cannon", category: "aoe", file: "squire_cannon.glb", kind: "cannon", cost: 150, description: "Heavy DD2 cannon. Wide AoE.", splashRadius: 5.0, projectile: "cannon" },
  howitzer: { id: "howitzer", name: "Howitzer", category: "aoe", file: "howitzer.glb", kind: "cannon", cost: 170, description: "Mechanical howitzer. Fat splash.", splashRadius: 5.6, projectile: "cannon" },
  railgun: { id: "railgun", name: "Railgun", category: "bolt", file: "railgun.glb", kind: "ballista", cost: 165, description: "Bolt rail — piercing single-target shot.", projectile: "ballista" },
  fire_tower: { id: "fire_tower", name: "Fire Tower", category: "magic", file: "fire_tower.glb", kind: "mage", cost: 165, description: "Magic fire tower. Lobbed fireballs.", splashRadius: 3.6, projectile: "fire" },
  helltower: { id: "helltower", name: "Hell Tower", category: "magic", file: "helltower.glb", kind: "mage", cost: 180, description: "Infernal spire. Fireball splash + slow.", splashRadius: 4.6, projectile: "fire" },
  missile: { id: "missile", name: "Missile Spire", category: "magic", file: "missile.glb", kind: "mage", cost: 170, description: "Magic missiles. Small clustered AoE.", splashRadius: 3.4, projectile: "wizard" },
  crystal: { id: "crystal", name: "Crystal Tower", category: "magic", file: "crystal.glb", kind: "mage", cost: 155, description: "Focus crystal. Slow pulse + shard bolt.", splashRadius: 3.8, projectile: "wizard" },
  jumper: { id: "jumper", name: "Jumper Mine", category: "trap", file: "jumper.glb", kind: "barrier", cost: 85, description: "Hidden. Pops at 1m, explodes 4m, stun + damage.", trap: { mode: "jumper", armRadius: 1, effectRadius: 4, damage: 95, stun: 1.25 } },
  spikes: { id: "spikes", name: "Spike Trap", category: "trap", file: "spikes.glb", kind: "barrier", cost: 95, description: "Hidden. Spikes on step — 4s field, heavy DoT + 5s slow.", trap: { mode: "spikes", armRadius: 1.05, effectRadius: 1.6, damage: 48, slowFactor: 0.38, slowDuration: 5, activeDuration: 4, tick: 0.45 } },
  tesla: { id: "tesla", name: "Tesla Coil", category: "trap", file: "tesla.glb", kind: "barrier", cost: 120, description: "Hidden until 2m. Shocks 3m for 10s or until razed.", trap: { mode: "tesla", armRadius: 2, effectRadius: 3, damage: 22, activeDuration: 10, tick: 0.28 } },
  barrier: { id: "barrier", name: "Barrier", category: "barrier", file: "", kind: "barrier", cost: 60, description: "Lane blocker. Soaks hits." },
};

export const KITS_BY_TAB: Record<DeployTab, DeployKitId[]> = {
  aoe: ["defence_tower", "squire_cannon", "howitzer"],
  magic: ["fire_tower", "helltower", "missile", "crystal"],
  bolt: ["railgun"],
  trap: ["jumper", "spikes", "tesla"],
};
export const DEPLOY_TAB_ORDER: DeployTab[] = ["aoe", "magic", "bolt", "trap"];
export const MAX_DEPLOY_TOWERS = 2;
export const MAX_DEPLOY_BARRIERS = 1;
export const MAX_DEPLOY_TRAPS = 3;

export function deployKitUrl(id: DeployKitId): string | null {
  const kit = DEPLOY_KITS[id];
  if (!kit?.file) return null;
  return `${LOCAL}models/buildings/deploy/${kit.file}`;
}
export function isDeployKitId(ref: string): ref is DeployKitId { return ref in DEPLOY_KITS; }
export function kitByRef(ref: string): DeployKit | undefined { return isDeployKitId(ref) ? DEPLOY_KITS[ref] : undefined; }
export function kitToShopItem(id: DeployKitId): ShopItem {
  const k = DEPLOY_KITS[id];
  return { id: k.id, name: k.name, cost: k.cost, kind: "build", ref: k.id, description: k.description };
}
export function tabShopItems(tab: DeployTab): ShopItem[] { return KITS_BY_TAB[tab].map(kitToShopItem); }

const kitByStructureId = new Map<number, DeployKitId>();
export function bindStructureKit(id: number, kitId: DeployKitId): void { kitByStructureId.set(id, kitId); }
export function kitForStructure(id: number): DeployKit | undefined {
  const k = kitByStructureId.get(id);
  return k ? DEPLOY_KITS[k] : undefined;
}
export interface TrapRuntime { sprung: boolean; age: number; tickAcc: number; }
const trapRuntime = new Map<number, TrapRuntime>();
export function trapState(id: number): TrapRuntime {
  let s = trapRuntime.get(id);
  if (!s) { s = { sprung: false, age: 0, tickAcc: 0 }; trapRuntime.set(id, s); }
  return s;
}
export function clearTrapState(id: number): void { trapRuntime.delete(id); kitByStructureId.delete(id); }
