import { Suspense, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { EM, type StructureEntity } from "../../game/entities";
import { useGame } from "../../game/store";
import { enemyGrudgeFaction, playerGrudgeFaction } from "../../engine/grudge6";
import {
  housePackUrl,
  houseStageForHp,
  scoreHouseStage,
  type HouseStage,
} from "../../engine/houseAssets";

const FIT = 5.4;

function meshCount(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) n++;
  });
  return n;
}

function topPieces(scene: THREE.Object3D): THREE.Object3D[] {
  const kids = scene.children.filter((c) => meshCount(c) > 0);
  if (kids.length >= 2) return kids;
  const named: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o === scene) return;
    if (/(house|home|healthy|damag|destroy|ruin)/i.test(o.name) && meshCount(o) > 0) named.push(o);
  });
  return named.length >= 2 ? named : [scene];
}

function pieceHeight(p: THREE.Object3D): number {
  return new THREE.Box3().setFromObject(p).getSize(new THREE.Vector3()).y;
}

function pickStage(scene: THREE.Object3D, stage: Exclude<HouseStage, "debris">): THREE.Object3D {
  const pieces = topPieces(scene);
  let best = pieces[0] ?? scene;
  let bestS = -1;
  for (const p of pieces) {
    let s = scoreHouseStage(p.name, stage);
    p.traverse((o) => {
      s = Math.max(s, scoreHouseStage(o.name, stage));
    });
    if (s > bestS) {
      bestS = s;
      best = p;
    }
  }
  if (bestS >= 4) return best;
  const ranked = [...pieces].sort((a, b) => pieceHeight(b) - pieceHeight(a));
  if (stage === "healthy") return ranked[0] ?? scene;
  if (stage === "damaged") return ranked[1] ?? ranked[0] ?? scene;
  return ranked[ranked.length - 1] ?? scene;
}

function fitHouse(root: THREE.Object3D, debrisOnly: boolean): void {
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.updateWorldMatrix(true, true);
  let box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let maxDim = Math.max(size.x, size.y, size.z, 0.001);
  if (maxDim > 60) {
    root.scale.setScalar(0.01);
    root.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(root);
    box.getSize(size);
    maxDim = Math.max(size.x, size.y, size.z, 0.001);
  }
  root.scale.setScalar(THREE.MathUtils.clamp(FIT / maxDim, 0.002, 8));
  root.updateWorldMatrix(true, true);
  if (debrisOnly) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const hy = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y;
      const n = (m.name || "").toLowerCase();
      m.visible = /(debris|rubble|chunk|plank|stone|brick|wreck)/.test(n) || hy < 1.15;
    });
  }
  root.updateWorldMatrix(true, true);
  box = new THREE.Box3().setFromObject(root);
  root.position.y = -box.min.y;
  root.position.x = -((box.min.x + box.max.x) / 2);
  root.position.z = -((box.min.z + box.max.z) / 2);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = !debrisOnly;
    m.receiveShadow = true;
  });
}

function HouseMesh({ url, stage }: { url: string; stage: HouseStage }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const visual = stage === "debris" ? "destroyed" : stage;
    const r = cloneSkeleton(pickStage(scene, visual));
    r.parent = null;
    fitHouse(r, stage === "debris");
    return r;
  }, [scene, stage]);
  return <primitive object={obj} />;
}

function HousePad({ s }: { s: StructureEntity }) {
  const factionId = s.faction === "enemy" ? enemyGrudgeFaction() : playerGrudgeFaction();
  const url = housePackUrl(factionId);
  const stage = houseStageForHp(s.hp, s.maxHp);
  return (
    <group position={[s.pos.x, s.pos.y, s.pos.z]} rotation={[0, s.faction === "ally" ? Math.PI : 0, 0]}>
      <Suspense fallback={null}>
        <HouseMesh key={`${url}-${stage}`} url={url} stage={stage} />
      </Suspense>
    </group>
  );
}

export function TownHouses() {
  const phase = useGame((st) => st.phase);
  const mapVersion = useGame((st) => st.mapVersion);
  const [, bump] = useState(0);
  const sig = useRef("");
  useFrame(() => {
    let key = "";
    for (const s of EM.structures) {
      if (s.kind !== "house") continue;
      key += `${s.id}:${houseStageForHp(s.hp, s.maxHp)},`;
    }
    if (key !== sig.current) {
      sig.current = key;
      bump((n) => n + 1);
    }
  });
  if (phase !== "battle") return null;
  return (
    <group key={mapVersion}>
      {EM.structures.filter((s) => s.kind === "house").map((s) => (
        <HousePad key={s.id} s={s} />
      ))}
    </group>
  );
}

try {
  useGLTF.preload(housePackUrl("crusade"));
  useGLTF.preload(housePackUrl("legion"));
  useGLTF.preload(housePackUrl("fabled"));
} catch {
  /* ignore */
}
