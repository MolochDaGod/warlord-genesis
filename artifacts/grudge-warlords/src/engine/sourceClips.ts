/**
 * Bind animations that SHIP ON THE FILE (GLB / FBX `.animations`) to a mixer.
 * Native clips already target this skeleton — do not rotation-only retarget them.
 */
import * as THREE from "three";
import type { LocoClips } from "../game/animDirector";
import { isPlayableClip } from "./assetVerify";
import { classifyConceptClips } from "./threeAnim/conceptClips";

export interface ClassifiedClips {
  idle: THREE.AnimationClip | null;
  walk: THREE.AnimationClip | null;
  run: THREE.AnimationClip | null;
  sprint: THREE.AnimationClip | null;
  attack: THREE.AnimationClip | null;
  extras: THREE.AnimationClip[];
}

function norm(name: string): string {
  return name.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Pull playable clips off a loaded FBX/GLTF root (Three attaches them as `.animations`). */
export function clipsFromLoadedFile(
  file: THREE.Object3D & { animations?: THREE.AnimationClip[] },
  extra?: THREE.AnimationClip[],
): THREE.AnimationClip[] {
  const raw = [
    ...(Array.isArray(file.animations) ? file.animations : []),
    ...(extra ?? []),
  ];
  const seen = new Set<string>();
  const out: THREE.AnimationClip[] = [];
  for (const c of raw) {
    if (!isPlayableClip(c)) continue;
    const key = `${c.name}:${c.duration.toFixed(3)}:${c.tracks.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function classifyNativeClips(clips: THREE.AnimationClip[]): ClassifiedClips {
  const concept = classifyConceptClips(clips);
  const used = new Set(
    [concept.idle, concept.walk, concept.run, concept.sprint, concept.slash, concept.kick, concept.attack].filter(
      Boolean,
    ) as THREE.AnimationClip[],
  );
  return {
    idle: concept.idle ?? null,
    walk: concept.walk ?? null,
    run: concept.run ?? null,
    sprint: concept.sprint ?? null,
    attack: concept.slash ?? concept.kick ?? concept.attack ?? null,
    extras: clips.filter((c) => isPlayableClip(c) && !used.has(c)),
  };
}

/** Native loco only if idle+walk+run exist. Missing names → null so Bip001 baked pack loads. */
export function locoFromNativeClips(clips: THREE.AnimationClip[]): LocoClips | null {
  const c = classifyNativeClips(clips);
  if (!c.idle || !c.walk || !c.run) return null;
  return {
    idle: c.idle,
    walk: c.walk,
    run: c.run,
    sprint: c.sprint ?? c.run,
  };
}

export function attackFromNativeClips(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  return classifyNativeClips(clips).attack;
}

/** Find a native clip whose name matches a skill / anim key. */
export function findNativeClip(
  clips: THREE.AnimationClip[],
  ...needles: Array<string | undefined>
): THREE.AnimationClip | null {
  const keys = needles
    .filter((n): n is string => Boolean(n))
    .map(norm)
    .filter(Boolean);
  if (!keys.length) return null;
  return (
    clips.find((c) => {
      const n = norm(c.name);
      return keys.some((k) => n.includes(k) || k.includes(n));
    }) ?? null
  );
}
