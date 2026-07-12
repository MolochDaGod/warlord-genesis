import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CylinderCollider } from "@react-three/rapier";
import { EM } from "../../game/entities";
import { TREE } from "../../game/config";
import { buildTreeArchetypes, makeLeafTexture } from "../../game/treegen";

// Fixed instance capacity is per-tree-element: every tree could pick the densest
// archetype, so size by the largest map's tree count times the worst-case
// branch / leaf counts. Unused / dead element slots collapse to a zero matrix.
const CAP_TREES = TREE.countLarge;

const _tree = new THREE.Matrix4();
const _world = new THREE.Matrix4();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _color = new THREE.Color();
const _UP = new THREE.Vector3(0, 1, 0);

/**
 * Procedural destructible trees. Each tree's visual is a recursive branch
 * skeleton + leaf cards baked once into a handful of archetypes (treegen.ts);
 * all branches render as one InstancedMesh and all leaves as another. Matrices
 * are rebuilt only when the alive-set or active map changes — not per frame.
 * Physical blocking for the hero is provided by per-tree fixed cylinder
 * colliders (re-rendered only when a tree dies). Unit pathing avoidance is
 * handled separately via the spatial-grid occupancy mask stamped in EM.
 */
export function Trees() {
  const branchRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const version = useRef("");
  const [, force] = useState(0);

  const { archetypes, branchGeo, leafGeo, barkMat, leafMat, leafTex, branchCAP, leafCAP } = useMemo(() => {
    const { archetypes, maxBranches, maxLeaves } = buildTreeArchetypes();
    const branchGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
    const leafGeo = new THREE.PlaneGeometry(1, 1);
    const leafTex = makeLeafTexture();
    const barkMat = new THREE.MeshStandardMaterial({ color: TREE.trunk, roughness: 0.92 });
    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0,
    });
    return {
      archetypes,
      branchGeo,
      leafGeo,
      barkMat,
      leafMat,
      leafTex,
      branchCAP: CAP_TREES * maxBranches,
      leafCAP: CAP_TREES * maxLeaves,
    };
  }, []);

  useEffect(() => {
    return () => {
      branchGeo.dispose();
      leafGeo.dispose();
      barkMat.dispose();
      leafMat.dispose();
      leafTex.dispose();
    };
  }, [branchGeo, leafGeo, barkMat, leafMat, leafTex]);

  const refresh = () => {
    const branch = branchRef.current;
    const leaf = leafRef.current;
    if (!branch || !leaf) return;
    const trees = EM.trees;
    let bc = 0;
    let lc = 0;
    for (let k = 0; k < CAP_TREES; k++) {
      const t = trees[k];
      if (!t || !t.alive) continue;
      const arch = archetypes[t.id % archetypes.length];
      _p.set(t.pos.x, EM.groundY(t.pos.x, t.pos.z), t.pos.z);
      _q.setFromAxisAngle(_UP, t.rot);
      _s.setScalar(t.scale);
      _tree.compose(_p, _q, _s);
      // Per-tree shade so neighbouring trees of the same archetype still differ.
      const shade = 0.86 + ((Math.imul(t.id, 2654435761) >>> 0) % 1000) / 1000 * 0.26;
      for (let i = 0; i < arch.branches.length; i++) {
        _world.multiplyMatrices(_tree, arch.branches[i]);
        branch.setMatrixAt(bc++, _world);
      }
      for (let i = 0; i < arch.leaves.length; i++) {
        _world.multiplyMatrices(_tree, arch.leaves[i]);
        leaf.setMatrixAt(lc, _world);
        _color.copy(arch.leafColors[i]).multiplyScalar(shade);
        leaf.setColorAt(lc, _color);
        lc++;
      }
    }
    for (let k = bc; k < branchCAP; k++) branch.setMatrixAt(k, _zero);
    for (let k = lc; k < leafCAP; k++) {
      leaf.setMatrixAt(k, _zero);
      leaf.setColorAt(k, _color);
    }
    branch.instanceMatrix.needsUpdate = true;
    leaf.instanceMatrix.needsUpdate = true;
    if (leaf.instanceColor) leaf.instanceColor.needsUpdate = true;
  };

  // Rebuild matrices + colliders only when the active map or the set of living
  // trees changes (map regenerates on every match; trees die when chopped).
  useFrame(() => {
    let key = `${EM.map.seed}:${EM.map.size}:`;
    for (const t of EM.trees) if (t.alive) key += `${t.id},`;
    if (key !== version.current) {
      version.current = key;
      refresh();
      force((n) => n + 1);
    }
  });

  return (
    <group>
      <instancedMesh
        ref={branchRef}
        args={[branchGeo, barkMat, branchCAP]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={leafRef}
        args={[leafGeo, leafMat, leafCAP]}
        receiveShadow
        frustumCulled={false}
      />
      {EM.trees
        .filter((t) => t.alive)
        .map((t) => {
          const gy = EM.groundY(t.pos.x, t.pos.z);
          const half = 1.2 * t.scale;
          return (
            <RigidBody
              key={t.id}
              type="fixed"
              colliders={false}
              position={[t.pos.x, gy, t.pos.z]}
              friction={0.9}
              restitution={0}
            >
              <CylinderCollider
                args={[half, t.radius]}
                position={[0, half, 0]}
                friction={0.95}
                restitution={0}
              />
            </RigidBody>
          );
        })}
    </group>
  );
}
