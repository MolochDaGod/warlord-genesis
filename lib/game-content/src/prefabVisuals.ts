// ── Canonical hero mesh sets (grudge-heros.puter.site) ────────────────────────
//
// Per-prefab visibleMeshes + animPack overrides. Built from race mesh catalogs;
// gun/crossbow reuse bow mesh until dedicated FBX land. Hoods applied on heads
// where the codex calls for scouts, shades, or forest spirits.

import type { AnimPackId } from "./animDefaults";
import { RACE_SKIN_TINT, prefabLoadout } from "./prefabLoadouts";

export interface PrefabVisual {
  visibleMeshes: string[];
  animPack: AnimPackId;
  /** Hex multiply on race texture (see RACE_SKIN_TINT). */
  skinTint: string;
}

/** Per-prefab canonical mesh loadout — keyed by stable prefab slug id. */
export const PREFAB_VISUAL_BY_ID: Record<string, PrefabVisual> = {
  // ── Human ───────────────────────────────────────────────────────────────────
  "sir-aldric-valorheart": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.human,
    visibleMeshes: [
      "WK_Units_head_F", "WK_Units_Body_E", "WK_Units_Arms_D", "WK_Units_Legs_C",
      "WK_Units_shoulderpads_B", "WK_weapon_sword_B", "WK_Shield_B",
    ],
  },
  "gareth-moonshadow": {
    animPack: "unarmed",
    skinTint: RACE_SKIN_TINT.human,
    visibleMeshes: [
      "WK_Units_head_C", "WK_Units_Body_B", "WK_Units_Arms_B", "WK_Units_Legs_B",
      "WK_weapon_sword_A", "WK_weapon_staff_B",
    ],
  },
  "archmage-elara-brightspire": {
    animPack: "magic",
    skinTint: RACE_SKIN_TINT.human,
    visibleMeshes: [
      "WK_Units_head_B", "WK_Units_Body_A", "WK_Units_Arms_A", "WK_Units_Legs_A",
      "WK_weapon_staff_C",
    ],
  },
  "kael-shadowblade": {
    animPack: "longbow",
    skinTint: RACE_SKIN_TINT.human,
    visibleMeshes: [
      "WK_Units_head_C", "WK_Units_Body_B", "WK_Units_Arms_B", "WK_Units_Legs_B",
      "WK_weapon_Bow", "WK_Xtra_quiver",
    ],
  },

  // ── Barbarian ───────────────────────────────────────────────────────────────
  "ulfgar-bonecrusher": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.barbarian,
    visibleMeshes: [
      "BRB_head_B", "BRB_body_C", "BRB_arms_B", "BRB_legs_B", "BRB_shoulderpads_B",
      "BRB_weapon_hammer_B",
    ],
  },
  "hrothgar-fangborn": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.barbarian,
    visibleMeshes: [
      "BRB_head_A", "BRB_body_B", "BRB_arms_B", "BRB_legs_B",
      "BRB_weapon_axe_A", "BRB_weapon_staff_B",
    ],
  },
  "volka-stormborn": {
    animPack: "magic",
    skinTint: RACE_SKIN_TINT.barbarian,
    visibleMeshes: [
      "BRB_head_A", "BRB_body_A", "BRB_arms_A", "BRB_legs_A", "BRB_weapon_staff_C",
    ],
  },
  "syala-windrider": {
    animPack: "longbow",
    skinTint: RACE_SKIN_TINT.barbarian,
    visibleMeshes: [
      "BRB_head_C", "BRB_body_B", "BRB_arms_B", "BRB_legs_B", "BRB_shoulderpads_A",
      "BRB_weapon_Bow",
    ],
  },

  // ── Dwarf ───────────────────────────────────────────────────────────────────
  "thane-ironshield": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.dwarf,
    visibleMeshes: [
      "DWF_Units_Head_F", "DWF_Units_Body_D", "DWF_Units_Arms_C", "DWF_Units_Legs_C",
      "DWF_Units_Shoulderpads_C", "DWF_Weapon_hammer_A", "DWF_Shield_B",
    ],
  },
  "bromm-earthshaker": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.dwarf,
    visibleMeshes: [
      "DWF_Units_Head_G", "DWF_Units_Body_C", "DWF_Units_Arms_B", "DWF_Units_Legs_B",
      "DWF_Units_Shoulderpads_B", "DWF_Weapon_hammer_B", "DWF_Weapon_staff_B",
    ],
  },
  "runa-forgekeeper": {
    animPack: "magic",
    skinTint: RACE_SKIN_TINT.dwarf,
    visibleMeshes: [
      "DWF_Units_Head_A", "DWF_Units_Body_A", "DWF_Units_Arms_A", "DWF_Units_Legs_A",
      "DWF_Weapon_staff_B",
    ],
  },
  "durin-tunnelwatcher": {
    animPack: "longbow",
    skinTint: RACE_SKIN_TINT.dwarf,
    visibleMeshes: [
      "DWF_Units_Head_C", "DWF_Units_Body_B", "DWF_Units_Arms_B", "DWF_Units_Legs_B",
      "DWF_Units_Shoulderpads_A", "DWF_Weapon_bow",
    ],
  },

  // ── Elf ─────────────────────────────────────────────────────────────────────
  "thalion-bladedancer": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.elf,
    visibleMeshes: [
      "ELF_Units_Head_G", "ELF_Units_Body_E", "ELF_Units_Arms_C", "ELF_Units_Legs_C",
      "ELF_Units_Shoulderpads_C", "ELF_weapon_sword_B",
    ],
  },
  "sylara-wildheart": {
    animPack: "unarmed",
    skinTint: RACE_SKIN_TINT.elf,
    visibleMeshes: [
      "ELF_Units_Head_D", "ELF_Units_Body_B", "ELF_Units_Arms_A", "ELF_Units_Legs_A",
      "ELF_weapon_staff_B",
    ],
  },
  "lyra-stormweaver": {
    animPack: "magic",
    skinTint: RACE_SKIN_TINT.elf,
    visibleMeshes: [
      "ELF_Units_Head_B", "ELF_Units_Body_A", "ELF_Units_Arms_A", "ELF_Units_Legs_A",
      "ELF_weapon_staff_C",
    ],
  },
  "aelindra-swiftbow": {
    animPack: "longbow",
    skinTint: RACE_SKIN_TINT.elf,
    visibleMeshes: [
      "ELF_Units_Head_C", "ELF_Units_Body_B", "ELF_Units_Arms_B", "ELF_Units_Legs_B",
      "ELF_Units_Shoulderpads_A", "ELF_weapon_bow", "ELF_Xtra_quiver",
    ],
  },

  // ── Orc ─────────────────────────────────────────────────────────────────────
  "grommash-ironjaw": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.orc,
    visibleMeshes: [
      "ORC_Units_Head_E", "ORC_Units_Body_C", "ORC_Units_Arms_B", "ORC_Units_Legs_B",
      "ORC_Units_Shoulderpads_C", "ORC_weapon_Axe_B",
    ],
  },
  "fenris-bloodfang": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.orc,
    visibleMeshes: [
      "ORC_Units_Head_A", "ORC_Units_Body_B", "ORC_Units_Arms_B", "ORC_Units_Legs_B",
      "ORC_weapon_Axe_A", "ORC_weapon_staff_C",
    ],
  },
  "zuejin-the-hexmaster": {
    animPack: "magic",
    skinTint: RACE_SKIN_TINT.orc,
    visibleMeshes: [
      "ORC_Units_Head_A", "ORC_Units_Body_A", "ORC_Units_Arms_A", "ORC_Units_Legs_A",
      "ORC_weapon_staff_C",
    ],
  },
  "razak-deadeye": {
    animPack: "longbow",
    skinTint: RACE_SKIN_TINT.orc,
    visibleMeshes: [
      "ORC_Units_Head_B", "ORC_Units_Body_B", "ORC_Units_Arms_B", "ORC_Units_Legs_B",
      "ORC_Units_Shoulderpads_A", "ORC_weapon_Bow",
    ],
  },

  // ── Undead ──────────────────────────────────────────────────────────────────
  "lord-malachar": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.undead,
    visibleMeshes: [
      "UD_Units_head_F", "UD_Units_body_F", "UD_Units_arms_D", "UD_Units_legs_D",
      "UD_Units_shoulderpads_C", "UD_weapon_Axe_B",
    ],
  },
  "the-ghoulfather": {
    animPack: "sword_shield",
    skinTint: RACE_SKIN_TINT.undead,
    visibleMeshes: [
      "UD_Units_head_G", "UD_Units_body_D", "UD_Units_arms_C", "UD_Units_legs_C",
      "UD_weapon_Sword_B", "UD_weapon_staff_D",
    ],
  },
  "necromancer-vexis": {
    animPack: "magic",
    skinTint: RACE_SKIN_TINT.undead,
    visibleMeshes: [
      "UD_Units_head_A", "UD_Units_body_G", "UD_Units_arms_B", "UD_Units_legs_B",
      "UD_weapon_staff_A",
    ],
  },
  "shade-whisper": {
    animPack: "longbow",
    skinTint: RACE_SKIN_TINT.undead,
    visibleMeshes: [
      "UD_Units_head_C", "UD_Units_body_B", "UD_Units_arms_B", "UD_Units_legs_B",
      "UD_Units_shoulderpads_A", "UD_weapon_Bow",
    ],
  },
};

export function prefabVisual(p: { id: string }): PrefabVisual {
  const hit = PREFAB_VISUAL_BY_ID[p.id];
  if (!hit) {
    throw new Error(`missing canonical visual for prefab "${p.id}"`);
  }
  const lo = prefabLoadout(p);
  return { ...hit, animPack: lo.animPack };
}