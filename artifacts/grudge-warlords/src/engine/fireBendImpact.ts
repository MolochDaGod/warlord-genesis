import * as THREE from "three";
import { EM } from "../game/entities";
import type { Faction } from "../game/config";

/**
 * Fire-bending impact — rising column + ring embers + shock (inner lane AoE).
 */
export function spawnFireBendImpact(
  pos: THREE.Vector3,
  opts: {
    faction: Faction;
    radius?: number;
    damage?: number;
    color?: string;
  },
): void {
  const radius = opts.radius ?? 4.8;
  const color = opts.color ?? "#ff5a1e";
  const secondary = "#fff3b0";
  const at = pos.clone();
  at.y += 0.15;

  EM.addFireBurst(at, color, 10, 0.85);
  EM.addFireBurst(at.clone().setY(at.y + 0.9), secondary, 6, 0.55);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const p = at.clone().add(new THREE.Vector3(Math.cos(a) * radius * 0.35, 0.25, Math.sin(a) * radius * 0.35));
    EM.addFire(p, i % 2 ? color : secondary, 0.38);
    EM.addEmber(p, i % 2 ? color : secondary);
  }
  EM.addSmoke(at, 0.85);
  EM.addImpact(at);
  EM.addShockwave({
    pos: new THREE.Vector3(at.x, 0.12, at.z),
    maxRadius: radius,
    duration: 0.42,
    damage: opts.damage ?? 0,
    color,
    faction: opts.faction,
  });
  EM.addSlashWave({
    origin: at,
    dir: new THREE.Vector3(0, 0, 1),
    range: radius * 0.7,
    speed: 16,
    width: 1.6,
    damage: 0,
    color,
    faction: opts.faction,
    spawnShock: true,
    shockRadius: radius * 0.45,
    shockDamage: 0,
    shockDuration: 0.28,
  });
}
