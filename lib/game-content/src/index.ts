import { z } from "zod";

/**
 * Single source-of-truth schema for authored game content.
 *
 * This is the data contract shared by:
 *  - the `/admin` authoring editors (read/write via the api-server),
 *  - the api-server write path (`PUT /admin/content` validates against this),
 *  - the production-readiness validator (`@workspace/scripts` → `validate-content`),
 *  - the 3D viewer (equipping authored weapons applies meshes/sockets/anims).
 *
 * Persistence default = committed repo config: the authored data lives at
 * `artifacts/character-viewer/public/content/gameContent.json` and is fetched at
 * runtime by the viewer.
 */

// ── Weapon type (mirrors viewer `weapons.ts` WeaponType) ──────────────────────
export type WeaponType =
  | "axe"
  | "sword"
  | "hammer"
  | "mace"
  | "staff"
  | "bow"
  | "spear"
  | "dagger"
  | "shield"
  | "pick"
  | "fishing"
  | "other";

// ── Gear slots (paper-doll) ───────────────────────────────────────────────────
export type GearSlotId =
  | "head"
  | "body"
  | "gloves"
  | "legs"
  | "mainHand"
  | "offHand"
  | "relic"
  | "item6"
  | "item7"
  | "portal";

export type ItemCategory =
  | "helmet"
  | "armor"
  | "gloves"
  | "legs"
  | "weapon"
  | "offhand"
  | "relic"
  | "consumable"
  | "material"
  | "portal";

export interface GearSlotDef {
  id: GearSlotId;
  label: string;
  /** Item categories that may be placed in this slot. */
  accepts: ItemCategory[];
  /** "Active" slots from the mockup (helmet active, off-hand modifier, relic active). */
  active?: boolean;
}

// ── Effects / VFX (bindings + placeholders) ───────────────────────────────────
export type EffectKind = "particle" | "projectile" | "aura" | "impact" | "buff";

export interface EffectDef {
  id: string;
  label: string;
  kind: EffectKind;
  /** Placeholder visual color until real shaders are authored. */
  color: string;
  /** Marks this as a binding + placeholder (no production shader yet). */
  placeholder: boolean;
  description?: string;
}

// ── Skills ────────────────────────────────────────────────────────────────────
export interface SkillDef {
  id: string;
  label: string;
  /** Which weapon family grants this skill ("any" = usable unarmed/all). */
  weaponType: WeaponType | "any";
  /** Bound animation clip (path under /anims) played when the skill triggers. */
  animClip?: string;
  /** Effect ids (VFX) bound to this skill. */
  effects: string[];
  cooldown?: number;
  description?: string;
}

// ── Weapons (authored layer over WEAPON_REGISTRY) ─────────────────────────────
export type WeaponSocket = "right" | "left" | "both" | "off";

export interface WeaponContentDef {
  id: string;
  label: string;
  type: WeaponType;
  /** Required combat animation pack id (animations.ts WEAPON_PACKS). */
  animPack: string;
  /** Skill ids granted while this weapon is equipped. */
  skills: string[];
  /** Links to a WEAPON_REGISTRY entry so the viewer can apply mesh/socket/anim. */
  registryId?: string;
  /** Hand socket — validated against HAND_BONE keys. */
  socket: WeaponSocket;
}

// ── Items ─────────────────────────────────────────────────────────────────────
export interface ItemDef {
  id: string;
  label: string;
  category: ItemCategory;
  /** Primary gear slot this item fills. */
  slot?: GearSlotId;
  /** If category === "weapon", links to a WeaponContentDef. */
  weaponId?: string;
  meshId?: string;
  stackable?: boolean;
  description?: string;
}

// ── Harvesting + professions (data + checks first) ────────────────────────────
export interface HarvestNodeDef {
  id: string;
  label: string;
  /** Profession id required to gather this node. */
  profession: string;
  /** Item ids produced by gathering. */
  yields: string[];
  /** Optional required tool weapon type (e.g. "pick"). */
  tool?: WeaponType;
}

export type ProfessionKind = "gathering" | "crafting";

export interface ProfessionDef {
  id: string;
  label: string;
  kind: ProfessionKind;
  /** Harvest node ids worked by this profession (gathering). */
  nodes: string[];
  /** Item ids this profession produces (gathered or crafted). */
  produces: string[];
}

// ── Loadout (equipment editor saved state) ────────────────────────────────────
export interface Loadout {
  race: string;
  /** slot id → item id */
  slots: Partial<Record<GearSlotId, string>>;
  /** Inventory bag — item ids or null for empty cells. */
  bag: (string | null)[];
}

// ── Root document ─────────────────────────────────────────────────────────────
export interface GameContent {
  version: string;
  gearSlots: GearSlotDef[];
  effects: EffectDef[];
  skills: SkillDef[];
  weapons: WeaponContentDef[];
  items: ItemDef[];
  harvestNodes: HarvestNodeDef[];
  professions: ProfessionDef[];
  loadout: Loadout;
}

// ── Zod schema (server write validation + runtime guard) ──────────────────────
const gearSlotId = z.enum([
  "head",
  "body",
  "gloves",
  "legs",
  "mainHand",
  "offHand",
  "relic",
  "item6",
  "item7",
  "portal",
]);

const itemCategory = z.enum([
  "helmet",
  "armor",
  "gloves",
  "legs",
  "weapon",
  "offhand",
  "relic",
  "consumable",
  "material",
  "portal",
]);

const weaponType = z.enum([
  "axe",
  "sword",
  "hammer",
  "mace",
  "staff",
  "bow",
  "spear",
  "dagger",
  "shield",
  "pick",
  "fishing",
  "other",
]);

export const gameContentSchema = z.object({
  version: z.string(),
  gearSlots: z.array(
    z.object({
      id: gearSlotId,
      label: z.string(),
      accepts: z.array(itemCategory),
      active: z.boolean().optional(),
    }),
  ),
  effects: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.enum(["particle", "projectile", "aura", "impact", "buff"]),
      color: z.string(),
      placeholder: z.boolean(),
      description: z.string().optional(),
    }),
  ),
  skills: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      weaponType: z.union([weaponType, z.literal("any")]),
      animClip: z.string().optional(),
      effects: z.array(z.string()),
      cooldown: z.number().optional(),
      description: z.string().optional(),
    }),
  ),
  weapons: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: weaponType,
      animPack: z.string(),
      skills: z.array(z.string()),
      registryId: z.string().optional(),
      socket: z.enum(["right", "left", "both", "off"]),
    }),
  ),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      category: itemCategory,
      slot: gearSlotId.optional(),
      weaponId: z.string().optional(),
      meshId: z.string().optional(),
      stackable: z.boolean().optional(),
      description: z.string().optional(),
    }),
  ),
  harvestNodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      profession: z.string(),
      yields: z.array(z.string()),
      tool: weaponType.optional(),
    }),
  ),
  professions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.enum(["gathering", "crafting"]),
      nodes: z.array(z.string()),
      produces: z.array(z.string()),
    }),
  ),
  loadout: z.object({
    race: z.string(),
    slots: z.record(gearSlotId, z.string()),
    bag: z.array(z.string().nullable()),
  }),
});

export type GameContentParsed = z.infer<typeof gameContentSchema>;

// ── Shared defines & patterns (game foundation) ───────────────────────────────
// Static catalogs consumed by both the viewer and the playable game artifact.
export * from "./ids";
export * from "./animations";
export * from "./animDefaults";
export * from "./castSpec";
export * from "./aoeMath";
export * from "./buildHandoff";
export * from "./omniLoco";
export * from "./terrainLoco";
export * from "./classes";
export * from "./skillIcons";
export * from "./classSkillMeta";
export * from "./masteryMap";
export * from "./weaponSkills";
export * from "./apiWeaponMatrix";
export * from "./apiWeaponLoco";
export * from "./mastery";
export * from "./combat";
export * from "./controller";
export * from "./tools";
export * from "./prefabs";
export * from "./prefabLoadouts";
export * from "./prefabVisuals";
export * from "./prefabBaked";
export * from "./entitySpec";
export * from "./npcSpec";
export * from "./aiAssistant";
export * from "./multiplayer";
