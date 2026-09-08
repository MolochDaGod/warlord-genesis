/**
 * Player-deployable fortifications.
 * Loadout: 2 towers + 1 barrier.
 * Categories: aoe · bolt · magic · engineering · trap · support
 *
 * models/buildings/deploy/<file>.glb
 */
import type { StructureKind } from "../game/config";

export type DeployCategory =
  | "aoe"
  | "bolt"
  | "magic"
  | "engineering"
  | "trap"
  | "support"
  | "barrier";

export type DeployKitId = "defence_tower" | "squire_cannon" | "howitzer" | "barrier";

export interface DeployKit {
  id: DeployKitId;
  name: string;
  category: DeployCategory;
  file: string;
  kind: StructureKind;
  cost: number;
  description: string;
  splashRadius?: number;
}

const LOCAL = import.meta.env.BASE_URL;

export const DEPLOY_KITS: Record<DeployKitId, DeployKit> = {
  defence_tower: {
    id: "defence_tower",
    name: "Defence Tower",
    category: "aoe",
    file: "defence_tower.glb",
    kind: "cannon",
    cost: 130,
    description: "Unity keep with a roof cannon. AoE shells.",
    splashRadius: 4.2,
  },
  squire_cannon: {
    id: "squire_cannon",
    name: "Squire Cannon",
    category: "aoe",
    file: "squire_cannon.glb",
    kind: "cannon",
    cost: 150,
    description: "Heavy DD2-style cannon tower. Wide AoE.",
    splashRadius: 5.0,
  },
  howitzer: {
    id: "howitzer",
    name: "Howitzer",
    category: "aoe",
    file: "howitzer.glb",
    kind: "cannon",
    cost: 170,
    description: "Mechanical howitzer. Slow, fat splash.",
    splashRadius: 5.6,
  },
  barrier: {
    id: "barrier",
    name: "Barrier",
    category: "barrier",
    file: "",
    kind: "barrier",
    cost: 60,
    description: "Lane blocker. Soaks hits.",
  },
};

export const DEFAULT_DEPLOY_LOADOUT: DeployKitId[] = ["defence_tower", "squire_cannon", "barrier"];
export const MAX_DEPLOY_TOWERS = 2;
export const MAX_DEPLOY_BARRIERS = 1;

export function deployKitUrl(id: DeployKitId): string | null {
  const kit = DEPLOY_KITS[id];
  if (!kit?.file) return null;
  return `${LOCAL}models/buildings/deploy/${kit.file}`;
}

export function isDeployKitId(ref: string): ref is DeployKitId {
  return ref in DEPLOY_KITS;
}

export function kitByRef(ref: string): DeployKit | undefined {
  return isDeployKitId(ref) ? DEPLOY_KITS[ref] : undefined;
}
