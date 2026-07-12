import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { EM } from "../../game/entities";
import { PROJECTILES, type ProjectileModel, type ProjectileDef } from "../../game/config";
import { projectileArcPosition } from "../../engine/math/splines";

const BASE = import.meta.env.BASE_URL;
const POOL_PER_MODEL = 14;

/**
 * ObjectStore currently has no archer/ballista/cannon FBX shells (all 404).
 * Default to procedural meshes so combat never floods the console with missing
 * models. Set VITE_PROJECTILE_FBX=1 to try loading real FBX when they ship.
 */
const TRY_FBX =
  typeof import.meta !== "undefined" &&
  String((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PROJECTILE_FBX ?? "") === "1";

const _q = new THREE.Quaternion();
const _rollQ = new THREE.Quaternion();

interface Proto {
  holder: THREE.Group;
  forward: THREE.Vector3;
}

/** Shared PBR map sets (loaded once, reused across every shell material). */
type TexSet = { diff: THREE.Texture; nor?: THREE.Texture };

function loadShellTextures(): Record<"metal" | "concrete", TexSet> {
  const loader = new THREE.TextureLoader();
  const tex = (file: string, srgb: boolean) => {
    const t = loader.load(`${BASE}textures/${file}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  };
  return {
    metal: { diff: tex("metal_diff.jpg", true), nor: tex("metal_nor.jpg", false) },
    concrete: { diff: tex("concrete_diff.jpg", true) },
  };
}

/**
 * Procedural shell when FBX is missing from ObjectStore / public.
 * Avoids 404 spam and keeps arrows / bolts / orbs visible in combat.
 */
function makeProceduralShell(def: ProjectileDef): THREE.Group {
  const g = new THREE.Group();
  const tint = def.tint ? new THREE.Color(def.tint) : null;
  const baseColor = new THREE.Color(def.material?.color ?? "#c0a878");
  const rough = def.material?.roughness ?? 0.55;
  const metal = def.material?.metalness ?? 0.35;

  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: rough,
    metalness: metal,
    emissive: tint ?? new THREE.Color(0x000000),
    emissiveIntensity: tint ? 0.85 : 0,
  });

  // Heavy splash shells → ball; arrows/ballista → shaft + tip along +X
  if (def.splash) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat);
    g.add(ball);
  } else {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), mat);
    shaft.rotation.z = Math.PI / 2;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.28, 6),
      mat.clone(),
    );
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 0.55;
    const fletch = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.18, 0.02),
      new THREE.MeshStandardMaterial({
        color: tint ?? new THREE.Color("#8a6a3a"),
        roughness: 0.85,
        metalness: 0.05,
      }),
    );
    fletch.position.x = -0.4;
    g.add(shaft, tip, fletch);
  }
  return g;
}

/**
 * Normalise a freshly-loaded FBX shell: uniformly scale it to a target world
 * size (the source files come in arbitrary units), recenter it on its own
 * origin so it rotates about its middle, tint it if magical, and report its
 * long axis so it can be aimed along its travel direction.
 */
function prepareProto(
  raw: THREE.Group,
  def: ProjectileDef,
  textures: Record<"metal" | "concrete", TexSet> | null,
): Proto {
  const box0 = new THREE.Box3().setFromObject(raw);
  const size0 = box0.getSize(new THREE.Vector3());
  const maxDim = Math.max(size0.x, size0.y, size0.z) || 1;
  raw.scale.setScalar(def.size / maxDim);
  raw.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(raw);
  const center = box.getCenter(new THREE.Vector3());
  raw.position.sub(center);

  const size = box.getSize(new THREE.Vector3());
  const forward =
    size.x >= size.y && size.x >= size.z
      ? new THREE.Vector3(1, 0, 0)
      : size.z >= size.y
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);

  if (textures) {
    const tintCol = def.tint ? new THREE.Color(def.tint) : null;
    const texSet = def.material ? textures[def.material.texture] : null;
    raw.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (def.material) {
        const sm = new THREE.MeshStandardMaterial({
          map: texSet?.diff ?? null,
          normalMap: texSet?.nor ?? null,
          color: new THREE.Color(def.material.color ?? "#ffffff"),
          roughness: def.material.roughness ?? 0.6,
          metalness: def.material.metalness ?? 0.4,
        });
        if (tintCol) {
          sm.emissive = tintCol;
          sm.emissiveIntensity = 0.9;
        }
        mesh.material = sm;
      } else if (tintCol) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sm = m as THREE.MeshStandardMaterial;
          if (sm && "emissive" in sm) {
            sm.emissive = tintCol;
            sm.emissiveIntensity = 0.9;
          }
        }
      }
    });
  }

  const holder = new THREE.Group();
  holder.add(raw);
  return { holder, forward };
}

/** HEAD request — only fetch FBX when the asset exists (avoids console 404 spam). */
async function assetExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return true;
    // Some CDNs disallow HEAD — try a ranged GET only when HEAD is not 404
    if (res.status === 405 || res.status === 501) {
      const get = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
      return get.ok || get.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Renders the flying shell meshes for every ranged shot. Travel and despawn are
 * driven imperatively here (mirroring the bolt pool in Effects); a per-model
 * pool of cloned FBX meshes is positioned each frame and aimed along the shot's
 * direction. Missing model files fall back to procedural shells (no 404 spam).
 */
export function Projectiles() {
  const groupRef = useRef<THREE.Group>(null);
  const data = useRef<{
    pools: Partial<Record<ProjectileModel, THREE.Object3D[]>>;
    forwards: Partial<Record<ProjectileModel, THREE.Vector3>>;
  }>({ pools: {}, forwards: {} });

  useEffect(() => {
    let disposed = false;
    const loader = new FBXLoader();
    const created: THREE.Object3D[] = [];
    let textures: Record<"metal" | "concrete", TexSet> | null = null;
    try {
      textures = loadShellTextures();
    } catch {
      textures = null;
    }

    (async () => {
      for (const key of Object.keys(PROJECTILES) as ProjectileModel[]) {
        if (disposed) return;
        const def = PROJECTILES[key];
        let proto: Proto;
        if (TRY_FBX) {
          const fbxUrl = `${BASE}models/projectiles/${def.file}.fbx`;
          try {
            const exists = await assetExists(fbxUrl);
            if (exists) {
              const raw = await loader.loadAsync(fbxUrl);
              proto = prepareProto(raw, def, textures);
            } else {
              proto = prepareProto(makeProceduralShell(def), def, null);
            }
          } catch {
            proto = prepareProto(makeProceduralShell(def), def, null);
          }
        } else {
          // Default path: zero network, zero 404s
          proto = prepareProto(makeProceduralShell(def), def, null);
        }
        if (disposed) return;
        const clones: THREE.Object3D[] = [];
        for (let i = 0; i < POOL_PER_MODEL; i++) {
          const c = proto.holder.clone(true);
          c.visible = false;
          clones.push(c);
          created.push(c);
          groupRef.current?.add(c);
        }
        data.current.pools[key] = clones;
        data.current.forwards[key] = proto.forward;
      }
    })();

    return () => {
      disposed = true;
      for (const o of created) {
        o.parent?.remove(o);
        o.traverse((n) => {
          const mesh = n as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) m?.dispose();
        });
      }
      if (textures) {
        for (const set of Object.values(textures)) {
          set.diff.dispose();
          set.nor?.dispose();
        }
      }
      data.current = { pools: {}, forwards: {} };
    };
  }, []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);

    // Advance + despawn. Light shells are visual only (damage dealt hitscan at
    // fire time); heavy shells explode at impact — area damage (+ optional slow)
    // via a shockwave, plus an extra fiery blast so the radius reads visually.
    for (let i = EM.projectiles.length - 1; i >= 0; i--) {
      const p = EM.projectiles[i];
      p.traveled += p.speed * dt;
      p.roll += p.spin * dt;
      if (p.traveled >= p.dist) {
        EM.addImpact(p.to);
        if (p.splash && p.faction) {
          const tint = PROJECTILES[p.model].tint ?? "#ffd0a6";
          EM.addFireBurst(p.to.clone(), tint, 6, 0.7);
          for (let k = 0; k < 6; k++) EM.addEmber(p.to.clone(), tint);
          EM.addSmoke(p.to.clone(), 0.7 + p.splash.radius * 0.12);
          EM.addShockwave({
            pos: new THREE.Vector3(p.to.x, 0.1, p.to.z),
            maxRadius: p.splash.radius,
            duration: 0.32,
            damage: p.splash.damage,
            color: tint,
            faction: p.faction,
            slow: p.splash.slow,
          });
        }
        EM.projectiles.splice(i, 1);
        continue;
      }
      projectileArcPosition(p.from, p.dir, p.traveled, p.dist, p.arc, p.pos);
      const def = PROJECTILES[p.model];
      const trailRate = def.splash ? 0.38 : 0.22;
      if (Math.random() < trailRate) {
        const tint = def.tint ?? (def.splash ? "#ffd0a6" : "#d4b890");
        EM.addEmber(p.pos.clone(), tint);
      }
    }

    const { pools, forwards } = data.current;
    for (const key of Object.keys(pools) as ProjectileModel[]) {
      const arr = pools[key];
      if (arr) for (const o of arr) o.visible = false;
    }
    const idx: Partial<Record<ProjectileModel, number>> = {};
    for (const p of EM.projectiles) {
      const arr = pools[p.model];
      const fwd = forwards[p.model];
      if (!arr || !fwd) continue;
      const k = idx[p.model] ?? 0;
      if (k >= arr.length) continue;
      idx[p.model] = k + 1;
      const o = arr[k];
      o.visible = true;
      o.position.copy(p.pos);
      _q.setFromUnitVectors(fwd, p.dir);
      if (p.spin !== 0) {
        _rollQ.setFromAxisAngle(p.dir, p.roll);
        _q.premultiply(_rollQ);
      }
      o.quaternion.copy(_q);
    }
  });

  return <group ref={groupRef} />;
}
