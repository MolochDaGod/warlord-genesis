/**
 * Woods rock dressing. Isolates every mesh in rockclusters.glb and instances
 * those pieces in jungle / ridge only — never on lanes.
 */
import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { useGame } from "../../game/store";
import type { RockSpot } from "../../game/mapgen";
import {
  envPackUrl,
  ROCK_COUNT_LARGE,
  ROCK_COUNT_STANDARD,
  ROCK_FIT_H,
  ROCK_LANE_CLEAR,
  ROCK_MIN_SPACING,
} from "../../engine/envAssets";
import { isolateMeshes, prepareGltfMaterials } from "../../engine/gltfScene";

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

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

function scatterWoods(): RockSpot[] {
  const map = EM.map;
  if (!map) return [];
  if (map.rocks?.length) return map.rocks;
  const rnd = mulberry32((map.seed ^ 0x51c3d9) >>> 0);
  const large = map.size === "large";
  const target = large ? ROCK_COUNT_LARGE : ROCK_COUNT_STANDARD;
  const rocks: RockSpot[] = [];
  const coreClear = 22;
  let attempts = 0;
  while (rocks.length < target && attempts < target * 140) {
    attempts++;
    const x = (rnd() - 0.5) * (map.width - 10);
    const z = (rnd() - 0.5) * (map.length - 10);
    if (Math.hypot(x - map.allyCore.x, z - map.allyCore.z) < coreClear) continue;
    if (Math.hypot(x - map.enemyCore.x, z - map.enemyCore.z) < coreClear) continue;
    const dW = map.distToPath(x, z);
    if (dW < ROCK_LANE_CLEAR) continue;
    const h = map.heightAt(x, z);
    const inWoods = dW < 18;
    const onRidge = h > 0.55 && inWoods;
    const deepWoods = h <= 0.55 && inWoods && dW > ROCK_LANE_CLEAR + 1.4;
    if (!onRidge && !deepWoods) continue;
    let tooClose = false;
    for (const r of rocks) {
      if (Math.hypot(r.x - x, r.z - z) < ROCK_MIN_SPACING) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    rocks.push({
      x, z,
      scale: 0.55 + rnd() * 1.35,
      rot: rnd() * Math.PI * 2,
      variant: Math.floor(rnd() * 64),
    });
  }
  return rocks;
}

function RockField({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const mapVersion = useGame((g) => g.mapVersion);
  const pieces = useMemo(() => {
    prepareGltfMaterials(scene);
    const iso = isolateMeshes(scene, { minDim: 0.12 });
    return iso.filter((p) => p.size.y > 0.15 || Math.max(p.size.x, p.size.z) > 0.4);
  }, [scene]);
  const spots = useMemo(() => scatterWoods(), [mapVersion, pieces.length]);
  const batches = useMemo(() => {
    if (!pieces.length || !spots.length) return [];
    return pieces.map((piece, pi) => ({
      piece,
      mine: spots.filter((r) => r.variant % pieces.length === pi),
    }));
  }, [pieces, spots]);
  if (!batches.length) return null;
  return (
    <group>
      {batches.map(({ piece, mine }, i) => {
        if (mine.length === 0) return null;
        const natH = Math.max(piece.size.y, 0.25);
        const unit = ROCK_FIT_H / natH;
        return (
          <instancedMesh
            key={`${piece.name}-${i}`}
            args={[piece.geometry, piece.material, mine.length]}
            castShadow
            receiveShadow
            frustumCulled={false}
            ref={(mesh) => {
              if (!mesh) return;
              for (let k = 0; k < mine.length; k++) {
                const r = mine[k];
                const gy = EM.groundY ? EM.groundY(r.x, r.z) : EM.map.heightAt(r.x, r.z);
                _p.set(r.x, gy, r.z);
                _q.setFromAxisAngle(_up, r.rot);
                _s.setScalar(unit * r.scale);
                _m.compose(_p, _q, _s);
                mesh.setMatrixAt(k, _m);
              }
              mesh.instanceMatrix.needsUpdate = true;
            }}
          />
        );
      })}
    </group>
  );
}

export function WoodsRocks() {
  const mapVersion = useGame((g) => g.mapVersion);
  return (
    <Suspense fallback={null}>
      <RockField key={mapVersion} url={envPackUrl("rockclusters")} />
    </Suspense>
  );
}

try {
  useGLTF.preload(envPackUrl("rockclusters"));
} catch {
  /* drop rockclusters.glb at deploy */
}
