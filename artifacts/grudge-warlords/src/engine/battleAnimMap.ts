/**
 * Battle hero clip slots → same-origin /anims/baked/*.json paths (no .json suffix;
 * loadBakedClipByRel adds it).
 */
import type { AnimPackId } from "@workspace/game-content";

export type BattleClipSlot =
  | "idle"
  | "idleAlt"
  | "walk"
  | "run"
  | "attack1"
  | "attack2"
  | "jumpAttack"
  | "jump"
  | "land"
  | "cast"
  | "hit"
  | "death"
  | "warcry";

export type BattleClipPaths = Record<BattleClipSlot, string[]>;

const SHARED: Pick<BattleClipPaths, "idleAlt" | "jump" | "land" | "warcry"> = {
  idleAlt: ["locomotion/idle (2)", "locomotion/idle (3)", "locomotion/idle"],
  jump: ["locomotion/jumping up", "sword_shield/jump", "magic/Standing Jump"],
  land: ["locomotion/hard landing", "locomotion/falling to roll"],
  warcry: [
    "locomotion/standing taunt battlecry",
    "sword_shield/sword and shield power up",
    "locomotion/pointing",
  ],
};

const BY_PACK: Record<AnimPackId, BattleClipPaths> = {
  sword_shield: {
    idle: ["sword_shield/sword and shield idle", "locomotion/idle"],
    idleAlt: SHARED.idleAlt,
    walk: ["locomotion/walking", "sword_shield/sword and shield run"],
    run: ["sword_shield/sword and shield run", "locomotion/running"],
    attack1: [
      "sword_shield/sword and shield attack",
      "sword_shield/sword and shield slash",
      "sword_shield/sword and shield attack (1)",
    ],
    attack2: [
      "sword_shield/sword and shield attack (2)",
      "sword_shield/sword and shield slash 1",
      "sword_shield/sword and shield attack (3)",
    ],
    jumpAttack: [
      "sword_shield/sword and shield attack (4)",
      "sword_shield/sword and shield slash (1)",
      "sword_shield/sword and shield attack",
    ],
    jump: SHARED.jump,
    land: SHARED.land,
    cast: ["sword_shield/sword and shield casting", "magic/spell casting"],
    hit: [
      "magic/Standing React Small From Front",
      "magic/Standing React Large From Front",
      "locomotion/reacting",
    ],
    death: ["sword_shield/sword and shield death", "magic/Standing React Death Backward"],
    warcry: SHARED.warcry,
  },
  magic: {
    idle: ["magic/standing idle", "magic/standing idle 02", "locomotion/idle"],
    idleAlt: ["magic/standing idle 02", ...SHARED.idleAlt],
    walk: ["magic/Standing Walk Forward", "locomotion/walking"],
    run: ["magic/Standing Run Forward", "locomotion/running"],
    attack1: [
      "magic/Standing 1H Magic Attack 01",
      "magic/standing 2h magic attack 01",
      "magic/standing 1h cast spell 01",
    ],
    attack2: [
      "magic/standing 2h magic attack 03",
      "magic/standing 2h magic attack 04",
      "magic/Standing 1H Magic Attack 01",
    ],
    jumpAttack: ["magic/Standing Jump", "magic/standing 2h magic attack 01"],
    jump: ["magic/Standing Jump", ...SHARED.jump],
    land: SHARED.land,
    cast: [
      "magic/spell casting",
      "magic/standing 1h cast spell 01",
      "magic/standing 2h cast spell 01",
    ],
    hit: [
      "magic/Standing React Small From Front",
      "magic/Standing React Large From Front",
    ],
    death: ["magic/Standing React Death Backward", "sword_shield/sword and shield death"],
    warcry: SHARED.warcry,
  },
  longbow: {
    idle: ["longbow/standing idle", "locomotion/idle"],
    idleAlt: SHARED.idleAlt,
    walk: ["locomotion/walking"],
    run: ["locomotion/running"],
    attack1: ["longbow/standing aim recoil", "longbow/firing rifle"],
    attack2: ["longbow/standing aim recoil"],
    jumpAttack: SHARED.jump,
    jump: SHARED.jump,
    land: SHARED.land,
    cast: ["longbow/standing aim recoil"],
    hit: ["magic/Standing React Small From Front", "locomotion/reacting"],
    death: ["magic/Standing React Death Backward"],
    warcry: SHARED.warcry,
  },
  unarmed: {
    idle: ["locomotion/idle", "unarmed/idle"],
    idleAlt: SHARED.idleAlt,
    walk: ["locomotion/walking"],
    run: ["locomotion/running"],
    attack1: ["unarmed/punching", "unarmed/kick"],
    attack2: ["unarmed/kick", "unarmed/punching"],
    jumpAttack: ["locomotion/kick", "unarmed/kick"],
    jump: SHARED.jump,
    land: SHARED.land,
    cast: ["locomotion/pointing"],
    hit: ["locomotion/reacting", "magic/Standing React Small From Front"],
    death: ["magic/Standing React Death Backward"],
    warcry: SHARED.warcry,
  },
  rifle: {
    idle: ["rifle/idle", "locomotion/idle"],
    idleAlt: SHARED.idleAlt,
    walk: ["locomotion/walking"],
    run: ["locomotion/running"],
    attack1: ["rifle/firing", "pistol/gunplay"],
    attack2: ["rifle/firing"],
    jumpAttack: SHARED.jump,
    jump: SHARED.jump,
    land: SHARED.land,
    cast: ["rifle/firing"],
    hit: ["magic/Standing React Small From Front"],
    death: ["magic/Standing React Death Backward"],
    warcry: SHARED.warcry,
  },
  pistol: {
    idle: ["pistol/idle", "locomotion/idle"],
    idleAlt: SHARED.idleAlt,
    walk: ["locomotion/walking"],
    run: ["locomotion/running"],
    attack1: ["pistol/gunplay", "rifle/firing"],
    attack2: ["pistol/gunplay"],
    jumpAttack: SHARED.jump,
    jump: SHARED.jump,
    land: SHARED.land,
    cast: ["pistol/gunplay"],
    hit: ["magic/Standing React Small From Front"],
    death: ["magic/Standing React Death Backward"],
    warcry: SHARED.warcry,
  },
};

export function battleClipPathsForPack(pack: AnimPackId): BattleClipPaths {
  return BY_PACK[pack] ?? BY_PACK.sword_shield;
}

export const BATTLE_CLIP_SLOTS: BattleClipSlot[] = [
  "idle", "idleAlt", "walk", "run", "attack1", "attack2",
  "jumpAttack", "jump", "land", "cast", "hit", "death", "warcry",
];
