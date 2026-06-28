// ---------------------------------------------------------------------------
// Grudge Warlords — procedural tree geometry.
//
// Builds a small set of deterministic "archetype" trees ONCE (a recursive
// branch skeleton + leaf cards scattered on the terminal branches), adapted
// from the instanced-forest reference. Each archetype is authored in LOCAL
// space (base at the origin, trunk up +Y, unit scale); the renderer (Trees.tsx)
// instances every branch and every leaf of every live tree by composing the
// archetype's local matrices with each tree's world transform (position on the
// terrain, yaw, per-tree scale). Keeping a handful of archetypes and instancing
// them keeps hundreds of real-looking trees to two draw calls.
//
// This module is pure (THREE only, no game state) and cosmetic — gameplay
// (colliders, pathing block mask, hp) is driven from the TREE config + entities.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { TREE } from "./config";

export interface TreeArchetype {
  /** Local branch matrices (unit cylinder along Y -> placed/scaled segment). */
  branches: THREE.Matrix4[];
  /** Local leaf-card matrices (unit plane -> placed/scaled/oriented leaf). */
  leaves: THREE.Matrix4[];
  /** Per-leaf base colour (parallel to `leaves`). */
  leafColors: THREE.Color[];
}

/** Deterministic PRNG (mulberry32) so archetypes are stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new THREE.Vector3(0, 1, 0);

/** Build a single archetype tree in local space from a seed. */
function buildOne(seed: number): TreeArchetype {
  const rnd = mulberry32(seed);
  const branches: THREE.Matrix4[] = [];
  const leaves: THREE.Matrix4[] = [];
  const leafColors: THREE.Color[] = [];

  const levels = TREE.branchLevels;
  const baseBranches = TREE.branchesPerNode;
  // Per-archetype shape variation.
  const branchAngle = 0.45 + rnd() * 0.25;
  const lengthFalloff = 0.66 + rnd() * 0.08;
  const radiusFalloff = 0.52 + rnd() * 0.1;
  const twist = 0.5;
  // Per-archetype canopy tint (green family).
  const leafHue = 0.26 + rnd() * 0.07;
  const leafLight = 0.34 + rnd() * 0.12;
  const trunkLength = 3.2 + rnd() * 1.8;
  const trunkRadius = 0.18 + rnd() * 0.12;

  const _q = new THREE.Quaternion();

  const addLeaves = (branchEnd: THREE.Vector3, branchDir: THREE.Vector3, topRadius: number, level: number) => {
    const count = 3 + Math.floor(rnd() * 3);
    const size = TREE.leafSize;

    // Two axes perpendicular to the branch to fan leaves around it.
    const perp1 = new THREE.Vector3(1, 0, 0);
    if (Math.abs(branchDir.y) > 0.9) perp1.set(0, 0, 1);
    perp1.crossVectors(branchDir, perp1).normalize();
    const perp2 = new THREE.Vector3().crossVectors(branchDir, perp1).normalize();

    for (let i = 0; i < count; i++) {
      const around = rnd() * Math.PI * 2;
      const outward = new THREE.Vector3()
        .addScaledVector(perp1, Math.cos(around))
        .addScaledVector(perp2, Math.sin(around))
        .normalize();

      // Attach on the branch surface, stem fanning outward/up.
      const attach = branchEnd.clone().addScaledVector(outward, topRadius);
      const stemDir = new THREE.Vector3()
        .addScaledVector(outward, 0.5 + rnd() * 0.3)
        .addScaledVector(branchDir, 0.3 + rnd() * 0.4)
        .add(new THREE.Vector3(0, 0.2 + rnd() * 0.3, 0))
        .normalize();

      // Orient the leaf: +Y (its tip) along the stem; face biased upward.
      const leafUp = stemDir.clone();
      let leafNormal = new THREE.Vector3(0, 1, 0).addScaledVector(outward, (rnd() - 0.5) * 0.5);
      leafNormal.sub(leafUp.clone().multiplyScalar(leafNormal.dot(leafUp))).normalize();
      if (leafNormal.lengthSq() < 0.1) {
        leafNormal.copy(outward);
        leafNormal.sub(leafUp.clone().multiplyScalar(leafNormal.dot(leafUp))).normalize();
      }
      const leafRight = new THREE.Vector3().crossVectors(leafUp, leafNormal).normalize();
      leafNormal.crossVectors(leafRight, leafUp).normalize();
      const rotM = new THREE.Matrix4().makeBasis(leafRight, leafUp, leafNormal);

      // Small random jitter so leaves don't look mechanically aligned.
      const jitter = new THREE.Quaternion().setFromEuler(
        new THREE.Euler((rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.2),
      );
      _q.setFromRotationMatrix(rotM).multiply(jitter);

      // PlaneGeometry(1,1) is centred; shift so its bottom edge meets the stem.
      const taper = 0.8 + 0.2 * (1 - level / Math.max(1, levels));
      const leafScale = size * (0.55 + rnd() * 0.5) * taper;
      const rotBottom = new THREE.Vector3(0, -0.5, 0).applyQuaternion(_q).multiplyScalar(leafScale);
      const pos = attach.clone().sub(rotBottom);

      leaves.push(new THREE.Matrix4().compose(pos, _q, new THREE.Vector3(leafScale, leafScale, leafScale)));

      // Per-leaf colour with light variation + occasional warm/grey tinge.
      let h = leafHue + (rnd() - 0.5) * 0.05;
      let s = 0.55 + rnd() * 0.12;
      let l = leafLight + (rnd() - 0.5) * 0.08;
      if (rnd() < 0.15) {
        if (rnd() < 0.5) {
          h += 0.03;
          l = Math.min(1, l + 0.08);
        } else {
          s = Math.max(0, s - 0.25);
          l = Math.max(0, l - 0.06);
        }
      }
      leafColors.push(new THREE.Color().setHSL(h, s, l));
    }
  };

  const branch = (start: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, level: number) => {
    if (level > levels || radius < 0.02) return;
    const end = start.clone().addScaledVector(dir, length);
    const mid = start.clone().lerp(end, 0.5);

    _q.setFromUnitVectors(UP, dir.clone().normalize());
    const topR = radius * radiusFalloff;
    const avgR = (radius + topR) * 0.5;
    branches.push(new THREE.Matrix4().compose(mid, _q, new THREE.Vector3(avgR, length, avgR)));

    // Leaves on the outer (terminal) levels only.
    if (level >= levels - 1) addLeaves(end, dir, topR, level);

    if (level < levels) {
      const n = level === 0 ? baseBranches + Math.floor(rnd() * 2) : Math.max(2, baseBranches - Math.floor(level * 0.3));
      for (let i = 0; i < n; i++) {
        const twistAngle = (i / n) * Math.PI * 2 + rnd() * twist;
        const bendAngle = branchAngle + (rnd() - 0.5) * 0.5;

        const perp = new THREE.Vector3(1, 0, 0);
        if (Math.abs(dir.y) < 0.9) perp.crossVectors(UP, dir).normalize();
        else perp.crossVectors(new THREE.Vector3(0, 0, 1), dir).normalize();

        const childDir = dir.clone();
        childDir.applyAxisAngle(perp, bendAngle);
        childDir.applyAxisAngle(dir, twistAngle);
        childDir.normalize();

        const startT = 0.45 + rnd() * 0.5;
        const childStart = start.clone().lerp(end, startT);
        const childLength = length * lengthFalloff * (0.8 + rnd() * 0.4);
        const childRadius = radius * radiusFalloff;
        branch(childStart, childDir, childLength, childRadius, level + 1);
      }
    }
  };

  branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), trunkLength, trunkRadius, 0);
  return { branches, leaves, leafColors };
}

/**
 * Build the archetype set. Returns the archetypes plus the worst-case branch /
 * leaf counts so the renderer can size its InstancedMesh capacity (every tree
 * could pick the densest archetype).
 */
export function buildTreeArchetypes(): {
  archetypes: TreeArchetype[];
  maxBranches: number;
  maxLeaves: number;
} {
  const archetypes: TreeArchetype[] = [];
  let maxBranches = 0;
  let maxLeaves = 0;
  for (let i = 0; i < TREE.archetypeCount; i++) {
    const a = buildOne(0x9e3779b9 ^ Math.imul(i + 1, 0x85ebca6b));
    archetypes.push(a);
    if (a.branches.length > maxBranches) maxBranches = a.branches.length;
    if (a.leaves.length > maxLeaves) maxLeaves = a.leaves.length;
  }
  return { archetypes, maxBranches, maxLeaves };
}

/**
 * Procedural leaf sprite drawn to a canvas: a soft green leaf silhouette with a
 * faint central vein. Used as the leaf-card alpha map (alphaTest in the
 * renderer), tinted per-instance by the baked leaf colours.
 */
export function makeLeafTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  const leafPath = () => {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.04);
    ctx.bezierCurveTo(s * 0.8, s * 0.2, s * 0.82, s * 0.66, s * 0.5, s * 0.97);
    ctx.bezierCurveTo(s * 0.18, s * 0.66, s * 0.2, s * 0.2, s * 0.5, s * 0.04);
  };

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#7ec06f");
  grad.addColorStop(0.4, "#5fa353");
  grad.addColorStop(1, "#3f8038");
  leafPath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Central vein.
  ctx.save();
  leafPath();
  ctx.clip();
  ctx.strokeStyle = "rgba(35, 60, 30, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.1);
  ctx.quadraticCurveTo(size * 0.5, size * 0.5, size * 0.5, size * 0.9);
  ctx.stroke();
  // A few side veins.
  ctx.strokeStyle = "rgba(40, 65, 35, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = size * (0.22 + i * 0.13);
    const spread = size * (0.16 + i * 0.02);
    ctx.beginPath();
    ctx.moveTo(size * 0.5, y);
    ctx.quadraticCurveTo(size * 0.5 - spread * 0.5, y + size * 0.04, size * 0.5 - spread, y + size * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.5, y);
    ctx.quadraticCurveTo(size * 0.5 + spread * 0.5, y + size * 0.04, size * 0.5 + spread, y + size * 0.06);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
