/**
 * Unit visuals — ONLY two families:
 *   • Lane guards / champions → GRUDGE6 Bip001 (AnimationDirector + baked clips)
 *   • All lane minions         → defaultcreeps pack (textured + embedded anims)
 *
 * KayKit, palette footman/archer/knight, and procedural cubes are removed.
 */
import { useMemo, useEffect, useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { EM } from "../../game/entities";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { UnitDef } from "../../game/config";
import {
  defaultCreepUrl,
  factionToCreepTeam,
  meshToCreepRole,
  type DefaultCreepRole,
} from "../../engine/assets";
import { jungleCreepUrl } from "../../engine/mapAssets";
import {
  loadGrudge6CharacterInstance,
  type PreparedGrudge6Character,
} from "../../engine/grudge6Character";
import { verifyLoadedAsset } from "../../engine/assetVerify";

/** MOBA creep height — defaultcreeps humanoids / carriages. */
const CREEP_FIT_HEIGHT = 1.65;
const SIEGE_FIT_HEIGHT = 1.35;
/** Lane guard GRUDGE6 heroes. */
const GUARD_FIT_HEIGHT = 2.05;
const FIT_SCALE_MIN = 0.002;
const FIT_SCALE_MAX = 6;

/**
 * Uniformly fit a unit root to targetHeight, feet on y=0, centered XZ.
 * Parent groups may still apply def.scale — do not bake it here.
 */
function fitUnitRoot(root: THREE.Object3D, targetHeight: number): void {
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.updateWorldMatrix(true, true);
  let box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let hy = Math.max(size.y, 0.001);
  if (hy > 8) {
    const decade = Math.pow(10, Math.round(Math.log10(hy / targetHeight)));
    if (decade > 1) {
      root.scale.setScalar(1 / decade);
      root.updateWorldMatrix(true, true);
      box = new THREE.Box3().setFromObject(root);
      box.getSize(size);
      hy = Math.max(size.y, 0.001);
    }
  }
  const s = THREE.MathUtils.clamp(targetHeight / hy, FIT_SCALE_MIN, FIT_SCALE_MAX);
  root.scale.setScalar(s);
  root.updateWorldMatrix(true, true);
  box = new THREE.Box3().setFromObject(root);
  root.position.y = -box.min.y;
  root.position.x = -((box.min.x + box.max.x) / 2);
  root.position.z = -((box.min.z + box.max.z) / 2);
}

function pickClip(names: string[], prefer: string[]): string | undefined {
  for (const p of prefer) {
    const hit = names.find((n) => n.toLowerCase().includes(p));
    if (hit) return hit;
  }
  return names[0];
}

/**
 * Defaultcreeps / jungle GLB — same pattern as plain Three.js:
 *
 *   const mixer = new AnimationMixer(clone);
 *   mixer.clipAction(gltf.animations[0]).play();
 *   // every frame: mixer.update(delta)
 *
 * Mixer is bound to the SkeletonUtils clone (not the cached useGLTF scene),
 * so each instance animates independently.
 */
function DefaultCreepUnit({
  url,
  unitId,
  fitHeight,
}: {
  url: string;
  unitId?: number;
  fitHeight: number;
}) {
  const { scene, animations } = useGLTF(url);
  const activeRef = useRef<string | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});

  const root = useMemo(() => {
    // Independent skeleton per unit (Object3D.clone → shared bones → T-pose)
    const r = cloneSkeleton(scene);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = false;
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      const next = mats.map((mat) => {
        const sm = (mat as THREE.MeshStandardMaterial).clone();
        if (sm.map) {
          sm.map.colorSpace = THREE.SRGBColorSpace;
          sm.map.needsUpdate = true;
        }
        if (sm.color) sm.color.set(0xffffff);
        sm.roughness = Math.min(0.92, sm.roughness ?? 0.75);
        sm.metalness = Math.min(0.2, sm.metalness ?? 0.05);
        sm.needsUpdate = true;
        return sm;
      });
      m.material = Array.isArray(m.material) ? next : next[0]!;
    });
    fitUnitRoot(r, fitHeight);
    verifyLoadedAsset({
      url,
      kind: "unit",
      root: r,
      clips: animations,
      targetHeight: fitHeight,
      requireClips: true,
      requireTextures: true,
    });

    // Mixer on THIS clone — same as loader.load → AnimationMixer(gltf.scene)
    const mixer = new THREE.AnimationMixer(r);
    mixerRef.current = mixer;
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of animations) {
      if (!clip?.name) continue;
      actions[clip.name] = mixer.clipAction(clip);
    }
    actionsRef.current = actions;

    const names = Object.keys(actions);
    const idle = pickClip(names, ["fight_idle", "idle", "stand"]);
    if (idle && actions[idle]) {
      actions[idle].reset().setLoop(THREE.LoopRepeat, Infinity).play();
      activeRef.current = idle;
      mixer.update(1 / 30);
    } else {
      console.error("[UnitMesh] no idle clip in", url, names);
    }

    return r;
  }, [scene, animations, fitHeight, url]);

  const clipNames = useMemo(() => Object.keys(actionsRef.current), [root]);
  const idleName = useMemo(
    () => pickClip(clipNames, ["fight_idle", "idle", "stand", "motion"]) ?? clipNames[0],
    [clipNames],
  );
  const runName = useMemo(
    () => pickClip(clipNames, ["run", "walk", "jog", "move"]) ?? idleName,
    [clipNames, idleName],
  );
  const atkName = useMemo(
    () => pickClip(clipNames, ["attack", "fight", "swing", "cast"]) ?? idleName,
    [clipNames, idleName],
  );

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    // Required every frame — without this the clip never advances
    mixer.update(Math.min(0.05, Math.max(0, delta)));

    if (unitId == null) return;
    const u = EM.units.find((x) => x.id === unitId);
    if (!u) return;
    const actions = actionsRef.current;
    const want =
      u.locomotion === "attack" ? atkName : u.locomotion === "run" ? runName : idleName;
    if (!want || want === activeRef.current || !actions[want]) return;
    const prev = activeRef.current ? actions[activeRef.current] : null;
    const next = actions[want];
    prev?.fadeOut(0.1);
    next.reset().fadeIn(0.1);
    if (want === atkName) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }
    next.play();
    activeRef.current = want;
  });

  useEffect(() => {
    return () => {
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
    };
  }, [root]);

  return <primitive object={root} />;
}

/** GRUDGE6 lane guard — independent instance (own skeleton + mixer + director). */
function LaneGuardMesh({
  typeId,
  unitId,
  faction,
}: {
  typeId: string;
  unitId?: number;
  faction: string;
}) {
  const tint = faction === "enemy" ? "#d65a47" : "#ffffff";
  const [prepared, setPrepared] = useState<
    (PreparedGrudge6Character & { dispose?: () => void }) | null
  >(null);
  const attackRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setPrepared(null);
    loadGrudge6CharacterInstance(typeId, { fitHeight: GUARD_FIT_HEIGHT, tint })
      .then((p) => {
        if (alive) setPrepared(p);
      })
      .catch((err) => {
        console.warn("[UnitMesh] GRUDGE6 guard failed", typeId, err);
        if (alive) setPrepared(null);
      });
    return () => {
      alive = false;
      setPrepared((cur) => {
        cur?.dispose?.();
        return null;
      });
    };
  }, [typeId, tint]);

  useFrame((_, dt) => {
    if (!prepared) return;
    const cap = Math.min(0.05, Math.max(0, dt));
    if (unitId == null) {
      prepared.director.update(cap);
      return;
    }
    const u = EM.units.find((x) => x.id === unitId);
    if (!u) {
      prepared.director.update(cap);
      return;
    }
    const moving = u.locomotion === "run";
    prepared.director.setGaitTarget(moving && u.locomotion !== "attack", false);
    if (u.locomotion === "attack" && !attackRef.current) {
      attackRef.current = true;
      const clip = prepared.attackClip;
      prepared.director.requestOneShot(clip, {
        fade: 0.08,
        timeScale: clip.duration > 0.9 ? clip.duration / 0.65 : 1,
      });
    } else if (u.locomotion !== "attack") {
      attackRef.current = false;
    }
    prepared.director.update(cap);
  });

  if (!prepared) return null;
  return <primitive object={prepared.root} />;
}

function CreepMesh({
  def,
  faction,
  unitId,
}: {
  def: UnitDef;
  faction: string;
  unitId?: number;
}) {
  // Sanctum jungle between lanes — elemental_lord / belerick (not defaultcreeps)
  if (def.mesh === "elemental_lord") {
    return (
      <DefaultCreepUnit
        url={jungleCreepUrl("elemental")}
        unitId={unitId}
        fitHeight={Math.max(2.4, CREEP_FIT_HEIGHT * def.scale)}
      />
    );
  }
  if (def.mesh === "belerick") {
    return (
      <DefaultCreepUnit
        url={jungleCreepUrl("belerick")}
        unitId={unitId}
        fitHeight={Math.max(1.9, CREEP_FIT_HEIGHT * def.scale)}
      />
    );
  }

  const team = factionToCreepTeam(faction);
  const role: DefaultCreepRole = meshToCreepRole(def.mesh, def.ranged);
  const url = defaultCreepUrl(team, role);
  const fitHeight = role === "siege" ? SIEGE_FIT_HEIGHT : CREEP_FIT_HEIGHT;
  return <DefaultCreepUnit url={url} unitId={unitId} fitHeight={fitHeight} />;
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
  if (isLaneGuard) {
    return <LaneGuardMesh typeId={def.id} unitId={unitId} faction={faction} />;
  }
  return <CreepMesh def={def} faction={faction} unitId={unitId} />;
}

// Preload all six defaultcreep GLBs so first wave never pops empty.
const CREEP_PRELOAD = [
  defaultCreepUrl("blue", "melee"),
  defaultCreepUrl("blue", "ranged"),
  defaultCreepUrl("blue", "siege"),
  defaultCreepUrl("red", "melee"),
  defaultCreepUrl("red", "ranged"),
  defaultCreepUrl("red", "siege"),
];
for (const url of CREEP_PRELOAD) {
  try {
    useGLTF.preload(url);
  } catch {
    /* ignore SSR / early */
  }
}
