/**
 * Authored battlefield GLB (Sanctum Island / Arena 1v1).
 *
 * CRITICAL: Do NOT plant on Box3.min.y — MOBA maps have cliffs/water far below
 * the lane deck. That put the whole island in the sky and left units walking
 * on the pathing plane under the map (looked like "game on the skybox floor").
 *
 * Fit: scale + center XZ → raycast-sample the upper walkable deck → shift so
 * deck median ≈ y=0 (matches mapgen heightfield + hero feet).
 */
import { useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "../../game/store";
import { EM } from "../../game/entities";
import { authoredMapForSize } from "../../engine/mapAssets";
import { clearMapSurface, registerMapSurface } from "../../engine/mapSurface";

const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3(0, -1, 0);
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

function collectMeshes(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      // Skip pure decorative tiny bits if needed later; keep all for deck hit
      out.push(m);
    }
  });
  return out;
}

/** Median of numbers (deck height samples). */
function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const a = [...vals].sort((x, y) => x - y);
  const m = (a.length / 2) | 0;
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

/**
 * Sample vertical rays across the XZ footprint; keep hits in the upper band of
 * the mesh (true lane deck), ignoring deep under-island geometry.
 */
function sampleDeckY(root: THREE.Object3D, meshes: THREE.Object3D[]): number {
  root.updateWorldMatrix(true, true);
  _box.setFromObject(root);
  if (_box.isEmpty()) return 0;

  const minX = _box.min.x;
  const maxX = _box.max.x;
  const minZ = _box.min.z;
  const maxZ = _box.max.z;
  const minY = _box.min.y;
  const maxY = _box.max.y;
  const spanY = Math.max(0.001, maxY - minY);

  // Only count hits in the upper ~55% of the mesh height (deck / buildings)
  const deckFloor = minY + spanY * 0.42;
  const rayTop = maxY + spanY * 0.35 + 20;

  const raycaster = new THREE.Raycaster();
  raycaster.far = spanY * 2.5 + 80;
  // dense enough for big sanctum
  const steps = 14;
  const hits: number[] = [];

  for (let iz = 0; iz <= steps; iz++) {
    for (let ix = 0; ix <= steps; ix++) {
      // Bias samples toward center (lanes), skip pure corners somewhat
      const u = ix / steps;
      const v = iz / steps;
      // slight center weight via smoothstep
      const cx = minX + (maxX - minX) * u;
      const cz = minZ + (maxZ - minZ) * v;
      _rayOrigin.set(cx, rayTop, cz);
      raycaster.set(_rayOrigin, _rayDir);
      const inter = raycaster.intersectObjects(meshes, false);
      for (const hit of inter) {
        if (hit.point.y >= deckFloor) {
          hits.push(hit.point.y);
          break; // first (highest) hit from above
        }
      }
    }
  }

  if (hits.length < 8) {
    // Fallback: use percentile of bbox — not min (cliff), not max (tower tips)
    return minY + spanY * 0.72;
  }
  return median(hits);
}

function fitMapToFootprint(
  root: THREE.Object3D,
  targetW: number,
  targetL: number,
): void {
  // Reset local transform
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateWorldMatrix(true, true);

  _box.setFromObject(root);
  if (_box.isEmpty()) return;
  _box.getSize(_size);
  const sx = Math.max(_size.x, 0.001);
  const sz = Math.max(_size.z, 0.001);
  // Uniform scale so lanes/props keep proportions (2m heroes vs map)
  const scale = Math.min(targetW / sx, targetL / sz);
  root.scale.setScalar(scale);
  root.updateWorldMatrix(true, true);

  // Center XZ on origin
  _box.setFromObject(root);
  _box.getCenter(_center);
  root.position.x -= _center.x;
  root.position.z -= _center.z;
  root.position.y = 0;
  root.updateWorldMatrix(true, true);

  // Plant DECK at y=0 (not mesh underside)
  const meshes = collectMeshes(root);
  const deckY = sampleDeckY(root, meshes);
  root.position.y -= deckY;
  root.updateWorldMatrix(true, true);

  // Record for debug / optional heightfield offset
  root.userData.mapDeckOffset = deckY;
  root.userData.mapPlanted = true;

  if (typeof console !== "undefined") {
    _box.setFromObject(root);
    console.info(
      `[AuthoredMap] deck→y0 (was deckY=${deckY.toFixed(2)}) boundsY=[${_box.min.y.toFixed(1)}, ${_box.max.y.toFixed(1)}]`,
    );
  }
}

function preserveMaps(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    // Ensure raycasts hit the deck
    m.raycast = THREE.Mesh.prototype.raycast;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    const next = mats.map((mat) => {
      const sm = (mat as THREE.MeshStandardMaterial).clone();
      if (sm.map) {
        sm.map.colorSpace = THREE.SRGBColorSpace;
        sm.map.needsUpdate = true;
      }
      if (sm.color) sm.color.set(0xffffff);
      sm.needsUpdate = true;
      return sm;
    });
    m.material = Array.isArray(m.material) ? next : next[0]!;
  });
}

export function AuthoredMapVisual() {
  const mapVersion = useGame((s) => s.mapVersion);
  const size = EM.map?.size ?? "standard";
  const def = authoredMapForSize(size);

  useEffect(() => {
    try {
      useGLTF.preload(def.url);
    } catch {
      /* ignore */
    }
  }, [def.url]);

  const { scene } = useGLTF(def.url);

  const root = useMemo(() => {
    const r = scene.clone(true);
    preserveMaps(r);
    const m = EM.map;
    const tw = m?.width ?? def.targetWidth;
    const tl = m?.length ?? def.targetLength;
    fitMapToFootprint(r, tw, tl);
    r.userData.authoredMapId = def.id;
    // Register for deck raycasts + tower pad sockets (all maps: sanctum + 1v1)
    registerMapSurface(r, def.id);
    // Re-seat structures/units that already exist onto the real deck
    try {
      EM.resyncToMapSurface?.();
    } catch {
      /* optional hook */
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, def.id, def.url, mapVersion]);

  useEffect(() => {
    return () => {
      clearMapSurface();
    };
  }, [mapVersion, def.id]);

  return <primitive object={root} />;
}
