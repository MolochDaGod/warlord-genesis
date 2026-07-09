import * as THREE from "three";

const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _hit = new THREE.Vector3();

/** Skip this object and its descendants when pulling the camera in. */
export const CAMERA_OCCLUDE_SKIP = "skipCameraOcclusion";

function isDescendantOf(obj: THREE.Object3D, ancestor: THREE.Object3D | null): boolean {
  if (!ancestor) return false;
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

function shouldOcclude(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData[CAMERA_OCCLUDE_SKIP]) return false;
    cur = cur.parent;
  }
  return true;
}

/**
 * Pull the desired third-person camera position toward the pivot when geometry
 * (trees, walls, terrain ridges) blocks the line of sight. Returns a position
 * along pivot→desired, inset by `margin` from the nearest hit.
 */
export function resolveCameraOcclusion(
  scene: THREE.Scene,
  pivot: THREE.Vector3,
  desired: THREE.Vector3,
  ignoreRoot: THREE.Object3D | null,
  margin = 0.32,
): THREE.Vector3 {
  _dir.subVectors(desired, pivot);
  const dist = _dir.length();
  if (dist < 1e-4) return desired;
  _dir.multiplyScalar(1 / dist);

  _ray.set(pivot, _dir);
  _ray.far = dist;
  _ray.near = 0.08;

  const hits = _ray.intersectObjects(scene.children, true);
  let nearest = dist;
  for (const h of hits) {
    if (!shouldOcclude(h.object)) continue;
    if (isDescendantOf(h.object, ignoreRoot)) continue;
    if (h.distance < nearest) nearest = h.distance;
  }

  const safe = Math.max(margin, nearest - margin);
  _hit.copy(pivot).addScaledVector(_dir, Math.min(dist, safe));
  return _hit;
}