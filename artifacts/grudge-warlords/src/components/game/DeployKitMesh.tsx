import { Suspense, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { deployKitUrl, type DeployKitId } from "../../engine/deployKits";
import { instantiateGltf, pickClip } from "../../engine/gltfScene";

const FIT: Record<DeployKitId, number> = {
  defence_tower: 6.4, squire_cannon: 5.8, howitzer: 5.2,
  railgun: 6.8, fire_tower: 6.2, helltower: 7.2, missile: 6.2, crystal: 6.0,
  jumper: 1.6, spikes: 2.2, tesla: 3.4, flytrap: 2.4, beartrap: 1.1,
  eng_turret: 4.8, bolt_ballista: 6.6, archer_tower: 7.0, flash_gun: 4.4,
  water_tower: 6.4, watchtower: 7.4, medic: 2.2, barrier: 3.4,
};

function KitInner({ kitId }: { kitId: DeployKitId }) {
  const url = deployKitUrl(kitId);
  if (!url) return null;
  return <KitGltf kitId={kitId} url={url} />;
}

function KitGltf({ kitId, url }: { kitId: DeployKitId; url: string }) {
  const gltf = useGLTF(url);
  const obj = useMemo(() => instantiateGltf(gltf.scene, { height: FIT[kitId] ?? 5.6 }), [gltf.scene, kitId]);
  const mixer = useMemo(() => new THREE.AnimationMixer(obj), [obj]);
  useEffect(() => {
    const clip = pickClip(gltf.animations ?? [], /flash|fire|shoot|attack|idle|spin/i);
    if (!clip) return;
    const act = mixer.clipAction(clip);
    act.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    return () => act.stop();
  }, [gltf.animations, mixer]);
  useFrame((_, dt) => mixer.update(dt));
  return <primitive object={obj} />;
}

export function DeployKitMesh({ kitId }: { kitId: DeployKitId }) {
  return (
    <Suspense fallback={null}>
      <KitInner key={kitId} kitId={kitId} />
    </Suspense>
  );
}
