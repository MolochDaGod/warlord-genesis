/**
 * Player-deployable fortifications.
 * Loadout cap: 2 towers + 1 barrier (all categories).
 * models/buildings/deploy/<file>.glb
 *
 * Magic:
 *   railguntower_building004.glb -> railgun.glb
 *   helltower.glb                -> helltower.glb
 *   missiletower_building002.glb -> missile.glb
 *   magic_crystal_tower.glb      -> crystal.glb
 */
import type { ProjectileModel, ShopItem, StructureKind } from "../game/config";

export type DeployCategory = "aoe" | "bolt" | "magic" | "engineering" | "trap" | "support" | "barrier";
export type DeployKitId =
  | "defence_tower" | "squire_cannon" | "howitzer"
  | "railgun" | "helltower" | "missile" | "crystal" | "barrier";
export type DeployTab = "aoe" | "magic";

export interface DeployKit {
  id: DeployKitId;
  name: string;
  category: DeployCategory;
  file: string;
  kind: StructureKind;
  cost: number;
  description: string;
  splashRadius?: number;
  projectile?: ProjectileModel;
}

const LOCAL = import.meta.env.BASE_URL;

export const DEPLOY_KITS: Record<DeployKitId, DeployKit> = {
  defence_tower: { id: "defence_tower", name: "Defence Tower", category: "aoe", file: "defence_tower.glb", kind: "cannon", cost: 130, description: "Roof-cannon keep. AoE shells.", splashRadius: 4.2, projectile: "cannon" },
  squire_cannon: { id: "squire_cannon", name: "Squire Cannon", category: "aoe", file: "squire_cannon.glb", kind: "cannon", cost: 150, description: "Heavy DD2 cannon. Wide AoE.", splashRadius: 5.0, projectile: "cannon" },
  howitzer: { id: "howitzer", name: "Howitzer", category: "aoe", file: "howitzer.glb", kind: "cannon", cost: 170, description: "Mechanical howitzer. Fat splash.", splashRadius: 5.6, projectile: "cannon" },
  railgun: { id: "railgun", name: "Railgun Spire", category: "magic", file: "railgun.glb", kind: "mage", cost: 165, description: "Arcane rail — piercing magic bolt.", splashRadius: 2.4, projectile: "wizard" },
  helltower: { id: "helltower", name: "Hell Tower", category: "magic", file: "helltower.glb", kind: "mage", cost: 180, description: "Infernal spire. Fireball splash + slow.", splashRadius: 4.6, projectile: "fire" },
  missile: { id: "missile", name: "Missile Spire", category: "magic", file: "missile.glb", kind: "mage", cost: 170, description: "Magic missiles. Small clustered AoE.", splashRadius: 3.4, projectile: "wizard" },
  crystal: { id: "crystal", name: "Crystal Tower", category: "magic", file: "crystal.glb", kind: "mage", cost: 155, description: "Focus crystal. Slow pulse + shard bolt.", splashRadius: 3.8, projectile: "wizard" },
  barrier: { id: "barrier", name: "Barrier", category: "barrier", file: "", kind: "barrier", cost: 60, description: "Lane blocker. Soaks hits." },
};

export const KITS_BY_TAB: Record<DeployTab, DeployKitId[]> = {
  aoe: ["defence_tower", "squire_cannon", "howitzer"],
  magic: ["railgun", "helltower", "missile", "crystal"],
};

export const DEFAULT_DEPLOY_LOADOUT: DeployKitId[] = ["defence_tower", "squire_cannon", "barrier"];
export const MAX_DEPLOY_TOWERS = 2;
export const MAX_DEPLOY_BARRIERS = 1;

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
export function bindStructureKit(structureId: number, kitId: DeployKitId): void { kitByStructureId.set(structureId, kitId); }
export function kitForStructure(structureId: number): DeployKit | undefined {
  const id = kitByStructureId.get(structureId);
  return id ? DEPLOY_KITS[id] : undefined;
}
