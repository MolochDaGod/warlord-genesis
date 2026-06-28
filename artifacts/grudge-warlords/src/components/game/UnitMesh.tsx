import { useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { useGLTF, useAnimations, useTexture } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { UnitDef } from "../../game/config";
import { bootEngine, getEngine } from "../../engine/boot";
import { resolveUnitAssets } from "../../engine/assets";

/** R2 CDN when reachable, else local public (Vercel /assets proxy). */
function useUnitAssets() {
  const [assets, setAssets] = useState(() => resolveUnitAssets(getEngine().cdnReachable));
  useEffect(() => {
    bootEngine().then((s) => setAssets(resolveUnitAssets(s.cdnReachable)));
  }, []);
  return assets;
}

/** Target world height the model is normalized to (parent group then applies def.scale). */
const UNIT_FIT_HEIGHT = 1.7;

/**
 * Render a skinned GLB unit model, normalized to a consistent height with feet at
 * y = 0, looping its idle clip. Cloned per instance (SkeletonUtils) so every unit
 * animates independently. drei's useAnimations drives the mixer each frame.
 */
/** Per-faction colour multiply applied over the shared palette swatch so both
 *  armies read as opposing teams while sharing the same humanoid models. Ally is
 *  left neutral (white = palette shown as authored); enemy is tinted warm-red. */
const FACTION_TINT: Record<string, string> = {
  ally: "#ffffff",
  enemy: "#d65a47",
};

function GLBUnit({ url, paletteUrl, tint }: { url: string; paletteUrl: string; tint: string }) {
  const { scene, animations } = useGLTF(url);
  const palette = useTexture(paletteUrl);
  // Build the instance scene AND its own cloned materials so the per-faction tint
  // never bleeds onto the other army (the GLTF cache shares source materials).
  const { root, mats } = useMemo(() => {
    // glTF UVs assume an unflipped, sRGB texture; sample the swatch with nearest
    // filtering so neighbouring palette cells never bleed into each other.
    palette.flipY = false;
    palette.colorSpace = THREE.SRGBColorSpace;
    palette.magFilter = THREE.NearestFilter;
    palette.minFilter = THREE.NearestFilter;
    palette.generateMipmaps = false;
    palette.needsUpdate = true;
    const r = cloneSkeleton(scene);
    const cloned: THREE.Material[] = [];
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      // Clone each source material, bind the palette swatch, and multiply by the
      // faction tint (white = unchanged for the ally side).
      const bind = (mat: THREE.Material): THREE.Material => {
        const sm = (mat as THREE.MeshStandardMaterial).clone();
        sm.map = palette;
        if (sm.color) sm.color.set(tint);
        sm.needsUpdate = true;
        cloned.push(sm);
        return sm;
      };
      if (Array.isArray(m.material)) m.material = m.material.map(bind);
      else if (m.material) m.material = bind(m.material);
    });
    const box = new THREE.Box3().setFromObject(r);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = UNIT_FIT_HEIGHT / (size.y || 1);
    r.scale.setScalar(s);
    r.position.y = -box.min.y * s;
    r.position.x = -((box.min.x + box.max.x) / 2) * s;
    r.position.z = -((box.min.z + box.max.z) / 2) * s;
    return { root: r, mats: cloned };
  }, [scene, palette, tint]);
  const { actions, names } = useAnimations(animations, root);
  useEffect(() => {
    const n = names[0];
    const a = n ? actions[n] : null;
    a?.reset().fadeIn(0.2).play();
    return () => {
      a?.fadeOut(0.2);
    };
  }, [actions, names]);
  // Dispose the per-instance cloned materials when this set is replaced/unmounted.
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return <primitive object={root} />;
}

/**
 * Render a unit with the shared skinned humanoid GLBs so BOTH factions use one
 * consistent model system — the enemy archetypes (grunt/raider/ogre) reuse the
 * same soldier meshes as their ally counterparts (footman/archer/knight) and are
 * told apart by the faction tint. Any unrecognised mesh kind falls back to the
 * lightweight procedural combatant.
 */
export function UnitMesh({ def, faction }: { def: UnitDef; faction: string }) {
  const tint = FACTION_TINT[faction] ?? "#ffffff";
  const { models: unitUrls, palette } = useUnitAssets();
  switch (def.mesh) {
    case "footman":
    case "grunt":
      return <GLBUnit url={unitUrls.footman} paletteUrl={palette} tint={tint} />;
    case "archer":
    case "raider":
      return <GLBUnit url={unitUrls.archer} paletteUrl={palette} tint={tint} />;
    case "knight":
    case "ogre":
      return <GLBUnit url={unitUrls.knight} paletteUrl={palette} tint={tint} />;
    default:
      return <ProceduralUnit def={def} />;
  }
}

/** Procedural fallback combatants (grunt/raider/ogre) — no skinned model. */
function ProceduralUnit({ def }: { def: UnitDef }) {
  const mats = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.7,
      metalness: 0.15,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: def.accent,
      emissive: def.accent,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.25,
    });
    const dark = new THREE.MeshStandardMaterial({ color: "#2b2118", roughness: 0.8 });
    return { body, accent, dark };
  }, [def]);

  useEffect(
    () => () => {
      mats.body.dispose();
      mats.accent.dispose();
      mats.dark.dispose();
    },
    [mats],
  );

  const { body, accent, dark } = mats;

  switch (def.mesh) {
    case "grunt":
      return (
        <group>
          <mesh material={body} position={[0, 0.85, 0]} castShadow rotation={[0.15, 0, 0]}>
            <capsuleGeometry args={[0.36, 0.6, 4, 8]} />
          </mesh>
          <mesh material={dark} position={[0, 1.35, 0.1]} castShadow>
            <sphereGeometry args={[0.24, 10, 8]} />
          </mesh>
          {/* horns */}
          {[-1, 1].map((s) => (
            <mesh key={s} material={accent} position={[s * 0.16, 1.5, 0.1]} rotation={[0, 0, s * 0.5]}>
              <coneGeometry args={[0.05, 0.25, 6]} />
            </mesh>
          ))}
          {/* club */}
          <mesh material={dark} position={[0.42, 0.95, 0.1]} rotation={[0, 0, 0.4]} castShadow>
            <boxGeometry args={[0.12, 0.8, 0.12]} />
          </mesh>
        </group>
      );
    case "raider":
      return (
        <group>
          <mesh material={body} position={[0, 0.85, 0]} castShadow>
            <capsuleGeometry args={[0.28, 0.65, 4, 8]} />
          </mesh>
          <mesh material={dark} position={[0, 1.4, 0]} castShadow>
            <sphereGeometry args={[0.2, 10, 8]} />
          </mesh>
          {/* staff with orb */}
          <mesh material={dark} position={[0.34, 1, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.4, 6]} />
          </mesh>
          <mesh material={accent} position={[0.34, 1.72, 0]}>
            <icosahedronGeometry args={[0.14, 0]} />
          </mesh>
        </group>
      );
    case "ogre":
    default:
      return (
        <group>
          <mesh material={body} position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[1.2, 1.5, 1]} />
          </mesh>
          <mesh material={dark} position={[0, 2, 0.1]} castShadow>
            <icosahedronGeometry args={[0.45, 0]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={body} position={[s * 0.85, 1.05, 0]} castShadow>
              <capsuleGeometry args={[0.24, 1.1, 4, 8]} />
            </mesh>
          ))}
          <mesh material={accent} position={[0, 1.1, 0.52]}>
            <boxGeometry args={[0.9, 0.14, 0.06]} />
          </mesh>
          {/* maul */}
          <mesh material={dark} position={[1.05, 1.4, 0.1]} rotation={[0, 0, 0.3]} castShadow>
            <boxGeometry args={[0.18, 0.3, 0.4]} />
          </mesh>
        </group>
      );
  }
}
