/**
 * Bind animations that SHIP ON THE FILE (GLB / FBX `.animations`) to a mixer.
 * Native clips already target this skeleton — do not rotation-only retarget them.
 */
import * as THREE from "three";
import type { LocoClips } from "../game/animDirector";
import { isPlayableClip } from "./assetVerify";

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

function hits(name: string, keys: string[]): boolean {
  const n = norm(name);
  return keys.some((k) => n.includes(k));
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
  const playable = clips.filter(isPlayableClip);
  const used = new Set<THREE.AnimationClip>();

  const take = (keys: string[]): THREE.AnimationClip | null => {
    const hit = playable.find((c) => !used.has(c) && hits(c.name, keys));
    if (hit) used.add(hit);
    return hit ?? null;
  };

  const idle = take(["idle", "stand", "fight idle", "breath"]);
  const walk = take(["walk", "walking"]);
  const run = take(["run", "running", "jog"]);
  const sprint = take(["sprint", "run fast", "charge"]);
  const attack = take([
    "attack",
    "slash",
    "strike",
    "swing",
    "punch",
    "combo",
    "cast",
    "shoot",
    "fire",
    "shot",
  ]);

  return {
    idle,
    walk,
    run,
    sprint,
    attack,
    extras: playable.filter((c) => !used.has(c)),
  };
}

/** Build a loco set from native clips. One real clip is enough — reuse it. Never empty. */
export function locoFromNativeClips(clips: THREE.AnimationClip[]): LocoClips | null {
  const c = classifyNativeClips(clips);
  const fallback = c.idle ?? c.walk ?? c.run ?? clips.find(isPlayableClip) ?? null;
  if (!fallback) return null;
  return {
    idle: c.idle ?? fallback,
    walk: c.walk ?? c.run ?? fallback,
    run: c.run ?? c.walk ?? fallback,
    sprint: c.sprint ?? c.run ?? fallback,
  };
}

export function attackFromNativeClips(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  return classifyNativeClips(clips).attack ?? clips.find(isPlayableClip) ?? null;
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
