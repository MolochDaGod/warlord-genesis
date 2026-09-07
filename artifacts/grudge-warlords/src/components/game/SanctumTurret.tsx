/**
 * Sanctum Island turret kit — models/maps/sanctum_turret.glb is a Sketchfab
 * pack (`turrent_controller`) that contains EVERY lane turret + both bases:
 *   Armature - {Bottom|Mid|Top} {Outer|Inner|Base} Turret ({Blue|Red})
 *   Base (Blue) / Base (Red)
 *
 * Each pad must instance ONE of those armatures. Cloning the whole scene
 * plants the mesh of all towers on every socket.
 */
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { sanctumTurretUrl } from "../../engine/mapAssets";

/** Fit height so a single turret fills a pad without covering the island. */
const TURRET_FIT_HEIGHT = 5.4;

type LaneBand = "Bottom" | "Mid" | "Top";
type TurretRung = "Outer" | "Inner";

function laneBand(lane: number): LaneBand {
  if (lane === 0) return "Bottom";
  if (lane === 2) return "Top";
  return "Mid";
}

function rungOf(tier: "outer" | "inner" | null | undefined): TurretRung {
  return tier === "inner" ? "Inner" : "Outer";
}

function sideColor(faction: string): "Blue" | "Red" {
  return faction === "enemy" ? "Red" : "Blue";
}

/** Kit piece names look like `Armature - Mid Outer Turret (Blue)_109`. */
function armatureNamePrefix(band: LaneBand, rung: TurretRung, color: "Blue" | "Red"): string {
  return `Armature - ${band} ${rung} Turret (${color})`;
}

function findKitPiece(root: THREE.Object3D, prefix: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found) return;
    const n = o.name || "";
    if (n === prefix || n.startsWith(prefix)) found = o;
  });
  return found;
}

function pickSingleTurret(
  scene: THREE.Object3D,
  faction: string,
  lane: number,
  tier: "outer" | "inner" | null | undefined,
): THREE.Object3D {
  const color = sideColor(faction);
  const rung = rungOf(tier);
  const preferred = [
    armatureNamePrefix(laneBand(lane), rung, color),
    armatureNamePrefix("Mid", rung, color),
    armatureNamePrefix("Bottom", rung, color),
    armatureNamePrefix("Top", rung, color),
  ];
  for (const prefix of preferred) {
    const hit = findKitPiece(scene, prefix);
    if (hit) return hit;
  }
  let fallback: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (fallback) return;
    const n = o.name || "";
    if (/^Armature - .+ Turret \((Blue|Red)\)/i.test(n) && n.includes(`(${color})`) && !/Base Turret/i.test(n)) {
      fallback = o;
    }
  });
  return fallback ?? scene;
}

function fitTurretOnPad(root: THREE.Object3D, targetH: number): void {
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.updateWorldMatrix(true, true);

  let box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let hy = Math.max(size.y, 0.001);
  if (hy > 20) {
    root.scale.setScalar(0.01);
    root.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(root);
    box.getSize(size);
    hy = Math.max(size.y, 0.001);
  }
  const xz = Math.max(size.x, size.z, 0.001);
  let s = targetH / hy;
  if (xz * s > 7) s *= 7 / (xz * s);
  root.scale.setScalar(s);
  root.updateWorldMatrix(true, true);
  box = new THREE.Box3().setFromObject(root);
  root.position.y = -box.min.y;
  root.position.x = -((box.min.x + box.max.x) / 2);
  root.position.z = -((box.min.z + box.max.z) / 2);
}

function dressTurret(root: THREE.Object3D, faction: string): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    const next = mats.map((mat) => {
      const sm = (mat as THREE.MeshStandardMaterial).clone();
      if (sm.map) {
        sm.map.colorSpace = THREE.SRGBColorSpace;
        sm.map.needsUpdate = true;
      }
      if (sm.color) sm.color.set(0xffffff);
      if (!sm.map && faction === "enemy" && sm.color) {
        sm.color.lerp(new THREE.Color("#c0392b"), 0.22);
      } else if (!sm.map && faction === "ally" && sm.color) {
        sm.color.lerp(new THREE.Color("#e0b252"), 0.12);
      }
      sm.needsUpdate = true;
      return sm;
    });
    m.material = Array.isArray(m.material) ? next : next[0]!;
  });
}

export function SanctumTurret({
  faction,
  lane = 1,
  tier = "outer",
}: {
  faction: string;
  lane?: number;
  tier?: "outer" | "inner" | null;
}) {
  const url = sanctumTurretUrl();
  const { scene } = useGLTF(url);
  const root = useMemo(() => {
    const piece = pickSingleTurret(scene, faction, lane, tier);
    const r = cloneSkeleton(piece);
    r.parent = null;
    dressTurret(r, faction);
    fitTurretOnPad(r, TURRET_FIT_HEIGHT);
    return r;
  }, [scene, faction, lane, tier]);

  return <primitive object={root} />;
}

try {
  useGLTF.preload(sanctumTurretUrl());
} catch {
  /* ignore */
}
