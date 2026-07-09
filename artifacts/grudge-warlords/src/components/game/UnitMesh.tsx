import { useMemo, useEffect, useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF, useAnimations, useTexture } from "@react-three/drei";
import { EM } from "../../game/entities";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { UnitDef } from "../../game/config";
import { bootEngine, getEngine } from "../../engine/boot";
import { kaykitEnemyUrlLocal, kaykitMobUrlLocal, resolveUnitAssets } from "../../engine/assets";
import {
  loadGrudge6LaneGuard,
  type PreparedGrudge6Character,
} from "../../engine/grudge6Character";

function useUnitAssets() {
  const [assets, setAssets] = useState(() => resolveUnitAssets(getEngine().cdnReachable));
  useEffect(() => {
    bootEngine().then((s) => setAssets(resolveUnitAssets(s.cdnReachable)));
  }, []);
  return assets;
}

/** MOBA creep height — simple walking lane mobs. */
const CREEP_FIT_HEIGHT = 1.7;
/** Lane guard GRUDGE6 heroes — Bip001 viewer bodies. */
const GUARD_FIT_HEIGHT = 2.05;

const FACTION_TINT: Record<string, string> = {
  ally: "#ffffff",
  enemy: "#d65a47",
};

function pickClip(names: string[], prefer: string[]): string | undefined {
  for (const p of prefer) {
    const hit = names.find((n) => n.toLowerCase().includes(p));
    if (hit) return hit;
  }
  return names[0];
}

function GLBUnit({
  url,
  paletteUrl,
  tint,
  unitId,
}: {
  url: string;
  paletteUrl: string;
  tint: string;
  unitId?: number;
}) {
  const { scene, animations } = useGLTF(url);
  const activeRef = useRef<string | null>(null);
  const palette = useTexture(paletteUrl);
  const { root, mats } = useMemo(() => {
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
    const s = CREEP_FIT_HEIGHT / (size.y || 1);
    r.scale.setScalar(s);
    r.position.y = -box.min.y * s;
    r.position.x = -((box.min.x + box.max.x) / 2) * s;
    r.position.z = -((box.min.z + box.max.z) / 2) * s;
    return { root: r, mats: cloned };
  }, [scene, palette, tint]);
  const { actions, names } = useAnimations(animations, root);
  const idleName = useMemo(() => pickClip(names, ["idle", "stand", "tpose"]), [names]);
  const runName = useMemo(() => pickClip(names, ["run", "walk", "jog", "move"]), [names]);
  const atkName = useMemo(() => pickClip(names, ["attack", "swing", "shoot", "slash"]), [names]);

  useEffect(() => {
    const a = idleName ? actions[idleName] : null;
    a?.reset().fadeIn(0.15).play();
    activeRef.current = idleName ?? null;
    return () => {
      a?.fadeOut(0.15);
    };
  }, [actions, idleName]);

  useFrame(() => {
    if (unitId == null) return;
    const u = EM.units.find((x) => x.id === unitId);
    if (!u) return;
    const want =
      u.locomotion === "attack" ? atkName : u.locomotion === "run" ? runName : idleName;
    if (!want || want === activeRef.current) return;
    const prev = activeRef.current ? actions[activeRef.current] : null;
    const next = actions[want];
    prev?.fadeOut(0.12);
    next?.reset().fadeIn(0.12).play();
    activeRef.current = want;
  });
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return <primitive object={root} />;
}

/** KayKit skeleton lane creeps (Legion undead minions only — not lane guards). */
function KayKitCreepUnit({
  url,
  unitId,
  scale = 1,
  tint = "#ffffff",
}: {
  url: string;
  unitId?: number;
  scale?: number;
  tint?: string;
}) {
  const { scene, animations } = useGLTF(url);
  const activeRef = useRef<string | null>(null);
  const root = useMemo(() => {
    const r = cloneSkeleton(scene);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      if (tint !== "#ffffff") {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const sm = mat as THREE.MeshStandardMaterial;
          if (sm?.color) sm.color.multiply(new THREE.Color(tint));
        }
      }
    });
    const box = new THREE.Box3().setFromObject(r);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = (CREEP_FIT_HEIGHT / (size.y || 1)) * scale;
    r.scale.setScalar(s);
    r.position.y = -box.min.y * s;
    r.position.x = -((box.min.x + box.max.x) / 2) * s;
    r.position.z = -((box.min.z + box.max.z) / 2) * s;
    return r;
  }, [scene, scale, tint]);
  const { actions, names } = useAnimations(animations, root);
  const idleName = useMemo(() => pickClip(names, ["idle", "stand", "tpose"]), [names]);
  const runName = useMemo(() => pickClip(names, ["run", "walk", "jog", "move"]), [names]);
  const atkName = useMemo(() => pickClip(names, ["attack", "swing", "shoot", "slash"]), [names]);

  useEffect(() => {
    const a = idleName ? actions[idleName] : null;
    a?.reset().fadeIn(0.15).play();
    activeRef.current = idleName ?? null;
    return () => {
      a?.fadeOut(0.15);
    };
  }, [actions, idleName]);

  useFrame(() => {
    if (unitId == null) return;
    const u = EM.units.find((x) => x.id === unitId);
    if (!u) return;
    const want =
      u.locomotion === "attack" ? atkName : u.locomotion === "run" ? runName : idleName;
    if (!want || want === activeRef.current) return;
    const prev = activeRef.current ? actions[activeRef.current] : null;
    const next = actions[want];
    prev?.fadeOut(0.12);
    next?.reset().fadeIn(0.12).play();
    activeRef.current = want;
  });
  return <primitive object={root} />;
}

/** GRUDGE6 lane guard — Bip001 race FBX + gear preset + baked clips from CDN. */
function LaneGuardMesh({
  typeId,
  unitId,
  faction,
}: {
  typeId: string;
  unitId?: number;
  faction: string;
}) {
  const tint = FACTION_TINT[faction] ?? "#ffffff";
  const [prepared, setPrepared] = useState<PreparedGrudge6Character | null>(null);
  const attackRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setPrepared(null);
    loadGrudge6LaneGuard(typeId, { fitHeight: GUARD_FIT_HEIGHT, tint })
      .then((p) => {
        if (alive) setPrepared(p);
      })
      .catch(() => {
        if (alive) setPrepared(null);
      });
    return () => {
      alive = false;
    };
  }, [typeId, tint]);

  useFrame((_, dt) => {
    if (!prepared) return;
    if (unitId == null) {
      prepared.director.update(dt);
      return;
    }
    const u = EM.units.find((x) => x.id === unitId);
    if (!u) {
      prepared.director.update(dt);
      return;
    }
    const moving = u.locomotion === "run";
    prepared.director.setGaitTarget(moving, u.locomotion === "run");
    if (u.locomotion === "attack" && !attackRef.current) {
      attackRef.current = true;
      prepared.director.requestOneShot(prepared.attackClip, { fade: 0.1 });
    } else if (u.locomotion !== "attack") {
      attackRef.current = false;
    }
    prepared.director.update(dt);
  });

  if (!prepared) return null;
  return <primitive object={prepared.root} />;
}

function CreepMesh({
  def,
  faction,
  unitId,
  kaykit,
}: {
  def: UnitDef;
  faction: string;
  unitId?: number;
  kaykit: Record<string, string>;
}) {
  const tint = FACTION_TINT[faction] ?? "#ffffff";
  const { models: unitUrls, palette } = useUnitAssets();
  switch (def.mesh) {
    case "skeleton_warrior":
      return (
        <KayKitCreepUnit
          url={kaykit.skeleton_warrior ?? kaykitEnemyUrlLocal("skeleton_warrior")}
          unitId={unitId}
          scale={def.scale}
          tint={tint}
        />
      );
    case "skeleton_mage":
      return (
        <KayKitCreepUnit
          url={kaykit.skeleton_mage ?? kaykitEnemyUrlLocal("skeleton_mage")}
          unitId={unitId}
          scale={def.scale * 0.95}
          tint={tint}
        />
      );
    case "kaykit_barbarian":
    case "kaykit_rogue_hooded":
    case "kaykit_knight":
    case "kaykit_ranger":
      return (
        <KayKitCreepUnit
          url={kaykit[def.mesh] ?? kaykitMobUrlLocal(def.mesh)}
          unitId={unitId}
          scale={def.scale}
          tint={tint}
        />
      );
    case "footman":
    case "grunt":
      return <GLBUnit url={unitUrls.footman} paletteUrl={palette} tint={tint} unitId={unitId} />;
    case "archer":
    case "raider":
      return <GLBUnit url={unitUrls.archer} paletteUrl={palette} tint={tint} unitId={unitId} />;
    case "knight":
    case "ogre":
      return <GLBUnit url={unitUrls.knight} paletteUrl={palette} tint={tint} unitId={unitId} />;
    default:
      return <ProceduralUnit def={def} />;
  }
}

export function UnitMesh({
  def,
  faction,
  unitId,
  isLaneGuard = false,
}: {
  def: UnitDef;
  faction: string;
  unitId?: number;
  isLaneGuard?: boolean;
}) {
  const { kaykit } = useUnitAssets();
  if (isLaneGuard) {
    return (
      <LaneGuardMesh typeId={def.id} unitId={unitId} faction={faction} />
    );
  }
  return <CreepMesh def={def} faction={faction} unitId={unitId} kaykit={kaykit} />;
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
          {[-1, 1].map((s) => (
            <mesh key={s} material={accent} position={[s * 0.16, 1.5, 0.1]} rotation={[0, 0, s * 0.5]}>
              <coneGeometry args={[0.05, 0.25, 6]} />
            </mesh>
          ))}
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
          <mesh material={dark} position={[1.05, 1.4, 0.1]} rotation={[0, 0, 0.3]} castShadow>
            <boxGeometry args={[0.18, 0.3, 0.4]} />
          </mesh>
        </group>
      );
  }
}