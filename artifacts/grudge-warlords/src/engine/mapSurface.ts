/**
 * Live authored-map surface registry.
 * After Sanctum / 1v1 GLB is fitted, we store the root so gameplay can
 * raycast the real deck for tower/unit Y (and snap turrets into pad holes).
 */
import * as THREE from "three";

export interface MapSocket {
  /** World XZ pad center (deck hole / base). */
  x: number;
  y: number;
  z: number;
  label: string;
}

let mapRoot: THREE.Object3D | null = null;
let mapMeshes: THREE.Object3D[] = [];
let sockets: MapSocket[] = [];
let mapId: string | null = null;

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3(0, -1, 0);
const _box = new THREE.Box3();
const raycaster = new THREE.Raycaster();

export function clearMapSurface(): void {
  mapRoot = null;
  mapMeshes = [];
  sockets = [];
  mapId = null;
}

export function getMapSurfaceId(): string | null {
  return mapId;
}

export function getMapSockets(): readonly MapSocket[] {
  return sockets;
}

/**
 * Register planted map root. Extracts pad sockets (dizuo / base-like nodes)
 * and caches meshes for deck raycasts.
 */
export function registerMapSurface(root: THREE.Object3D, id: string): void {
  mapRoot = root;
  mapId = id;
  mapMeshes = [];
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) mapMeshes.push(m);
  });
  sockets = extractSockets(root);
  if (typeof console !== "undefined") {
    console.info(
      `[mapSurface] registered ${id}: meshes=${mapMeshes.length} sockets=${sockets.length}`,
      sockets.map((s) => `${s.label}@(${s.x.toFixed(1)},${s.z.toFixed(1)})`),
    );
  }
}

function extractSockets(root: THREE.Object3D): MapSocket[] {
  const out: MapSocket[] = [];
  const v = new THREE.Vector3();
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  root.traverse((o) => {
    const n = o.name || "";
    // Chinese ML kit: dizuo = pedestal / empty tower pad on Sanctum deck
    const isPad = /dizuo|tower.?pad|turret.?pad|pad_0|base_tower|socket/i.test(n);
    if (!isPad) return;
    // Prefer mesh bbox center (node pivots are often at origin)
    let hasMesh = false;
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) hasMesh = true;
    });
    if (hasMesh) {
      box.setFromObject(o);
      if (!box.isEmpty()) {
        box.getCenter(center);
        out.push({ x: center.x, y: box.min.y, z: center.z, label: n });
        return;
      }
    }
    o.getWorldPosition(v);
    out.push({ x: v.x, y: v.y, z: v.z, label: n });
  });

  // Extra pad-like low platforms (statues / crystals) when few dizuo exist
  if (out.length < 6) {
    root.traverse((o) => {
      const n = o.name || "";
      if (!/statue_01|crystal_01|jidi_blue|jidi_red/i.test(n)) return;
      box.setFromObject(o);
      if (box.isEmpty()) return;
      box.getSize(size);
      box.getCenter(center);
      // Pad-like: low height relative to width
      if (size.y > 6 || size.x < 1.5 || size.z < 1.5) return;
      if (center.y < -8 || center.y > 10) return;
      out.push({ x: center.x, y: box.min.y, z: center.z, label: n });
    });
  }

  // Deduplicate near-identical sockets
  const dedup: MapSocket[] = [];
  for (const s of out) {
    if (dedup.some((d) => (d.x - s.x) ** 2 + (d.z - s.z) ** 2 < 4)) continue;
    dedup.push(s);
  }
  return dedup;
}

/**
 * Raycast the map deck at world XZ. Returns surface Y or null if no hit.
 * Prefer upper-deck hits (ignore deep under-island).
 */
export function sampleDeckY(x: number, z: number, fallback = 0): number {
  if (!mapRoot || mapMeshes.length === 0) return fallback;

  mapRoot.updateWorldMatrix(true, true);
  _box.setFromObject(mapRoot);
  if (_box.isEmpty()) return fallback;

  const minY = _box.min.y;
  const maxY = _box.max.y;
  const span = Math.max(0.001, maxY - minY);
  const deckFloor = minY + span * 0.4;
  const top = maxY + 40;

  _origin.set(x, top, z);
  raycaster.far = span * 3 + 100;
  raycaster.set(_origin, _dir);
  const hits = raycaster.intersectObjects(mapMeshes, false);
  for (const h of hits) {
    if (h.point.y >= deckFloor - 0.5) return h.point.y;
  }
  // Any hit as last resort
  if (hits[0]) return hits[0].point.y;
  return fallback;
}

/** Snap a world XZ to nearest pad socket if within maxDist; keep deck Y. */
export function snapToNearestSocket(
  x: number,
  z: number,
  maxDist = 18,
): { x: number; y: number; z: number; snapped: boolean } {
  if (sockets.length === 0) {
    return { x, y: sampleDeckY(x, z), z, snapped: false };
  }
  let best: MapSocket | null = null;
  let bestD = maxDist * maxDist;
  for (const s of sockets) {
    const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (!best) {
    return { x, y: sampleDeckY(x, z), z, snapped: false };
  }
  // Prefer raycast Y at socket (more accurate than node pivot)
  const y = sampleDeckY(best.x, best.z, best.y);
  return { x: best.x, y, z: best.z, snapped: true };
}

/**
 * Place a lane tower on the Sanctum deck:
 * try socket snap first (holes), else deck raycast at intended XZ.
 */
export function placeTowerOnDeck(
  x: number,
  z: number,
  preferSockets: boolean,
): { x: number; y: number; z: number } {
  if (preferSockets) {
    const s = snapToNearestSocket(x, z, 22);
    if (s.snapped) return { x: s.x, y: s.y, z: s.z };
  }
  return { x, y: sampleDeckY(x, z, 0), z };
}
