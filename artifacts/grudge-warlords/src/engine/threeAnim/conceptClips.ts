/**
 * Concept animation map — Samurai ANIMATION_URLS + Mixamo / Bip001 aliases.
 * Adding a combat beat is a name here, then a one-shot on the director.
 *
 * Ref: SamuraiThirdPersonTemplateThreeJS/src/animation/CharacterController.js
 *      threejs-game-skills gameplay-systems: idle, walk/run, jump, attack
 */
import type { AnimationClip } from "three";
import { isPlayableClip } from "../assetVerify";

export type ConceptId =
  | "idle"
  | "walk"
  | "run"
  | "sprint"
  | "jump"
  | "hop"
  | "land"
  | "slash"
  | "kick"
  | "crouch"
  | "attack";

const ALIASES: Record<ConceptId, string[]> = {
  idle: ["idle", "stand", "fight idle", "breath", "idle_sword"],
  walk: ["walk", "walking", "walk_sword", "walk forward"],
  run: ["run", "running", "jog", "run_sword", "run forward"],
  sprint: ["sprint", "run fast", "charge"],
  jump: ["bigjump", "big jump", "jumping up", "jump"],
  hop: ["hop", "in place jump"],
  land: ["land", "landing", "hard landing"],
  slash: ["slash", "slashhit", "sword slash", "great sword slash", "sword and shield attack"],
  kick: ["kick", "drop kick"],
  crouch: ["crouch", "crouch idle", "crouchslash"],
  attack: ["attack", "strike", "swing", "punch", "combo", "cast", "shoot", "fire", "shot"],
};

function norm(name: string): string {
  return name.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function hits(name: string, keys: string[]): boolean {
  const n = norm(name);
  return keys.some((k) => n.includes(k));
}

export function classifyConceptClips(clips: AnimationClip[]): Partial<Record<ConceptId, AnimationClip>> {
  const playable = clips.filter(isPlayableClip);
  const used = new Set<AnimationClip>();
  const take = (id: ConceptId): AnimationClip | undefined => {
    const hit = playable.find((c) => !used.has(c) && hits(c.name, ALIASES[id]));
    if (hit) used.add(hit);
    return hit;
  };
  const out: Partial<Record<ConceptId, AnimationClip>> = {};
  // Specific combat names before generic "attack"
  for (const id of [
    "idle",
    "walk",
    "run",
    "sprint",
    "jump",
    "hop",
    "land",
    "slash",
    "kick",
    "crouch",
    "attack",
  ] as ConceptId[]) {
    const c = take(id);
    if (c) out[id] = c;
  }
  return out;
}

export function conceptClip(
  clips: AnimationClip[],
  id: ConceptId,
): AnimationClip | null {
  return classifyConceptClips(clips)[id] ?? null;
}
