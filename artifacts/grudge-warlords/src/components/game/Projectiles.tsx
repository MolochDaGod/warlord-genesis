import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { EM } from "../../game/entities";
import { PROJECTILES, type ProjectileModel, type ProjectileDef } from "../../game/config";

const BASE = import.meta.env.BASE_URL;
const POOL_PER_MODEL = 14;

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
 * Normalise a freshly-loaded FBX shell: uniformly scale it to a target world
 * size (the source files come in arbitrary units), recenter it on its own
 * origin so it rotates about its middle, tint it if magical, and report its
 * long axis so it can be aimed along its travel direction.
 */
function prepareProto(
  raw: THREE.Group,
  def: ProjectileDef,
  textures: Record<"metal" | "concrete", TexSet>,
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

  // Dress the shell with a real surface: swap in a PBR-textured standard
  // material (so cannonballs read as solid iron, arrows as matte wood, etc.),
  // then layer the emissive tint on top for fiery / magical shells.
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

  const holder = new THREE.Group();
  holder.add(raw);
  return { holder, forward };
}

/**
 * Renders the flying shell meshes for every ranged shot. Travel and despawn are
 * driven imperatively here (mirroring the bolt pool in Effects); a per-model
 * pool of cloned FBX meshes is positioned each frame and aimed along the shot's
 * direction. Missing model files are skipped silently so the game still runs.
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
    const textures = loadShellTextures();
    (async () => {
      for (const key of Object.keys(PROJECTILES) as ProjectileModel[]) {
        const def = PROJECTILES[key];
        let proto: Proto;
        try {
          const raw = await loader.loadAsync(`${BASE}models/projectiles/${def.file}.fbx`);
          proto = prepareProto(raw, def, textures);
        } catch {
          continue;
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
      for (const set of Object.values(textures)) {
        set.diff.dispose();
        set.nor?.dispose();
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
          // Bigger blast: extra embers/smoke scaled to the radius.
          EM.addFireBurst(p.to.clone(), tint, 6, 0.7);
          for (let k = 0; k < 6; k++) EM.addEmber(p.to.clone(), tint);
          EM.addSmoke(p.to.clone(), 0.7 + p.splash.radius * 0.12);
          // AoE damage pass via the shared shockwave mechanism (each entity hit
          // once); the expanding ring aligns the damage with the blast visual.
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
      p.pos.copy(p.from).addScaledVector(p.dir, p.traveled);
      if (p.arc > 0 && p.dist > 1e-3) {
        const f = p.traveled / p.dist;
        p.pos.y += p.arc * 4 * f * (1 - f);
      }
      // Motion trail — helps read shell velocity and arc at a glance.
      if (Math.random() < 0.22) {
        const tint = PROJECTILES[p.model].tint ?? "#ffd8a8";
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
