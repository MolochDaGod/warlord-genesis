/**
 * Arena 3 level mesh — Clash Royale–style battlefield art.
 * Source: D:\Games\Models\arena3.glb → models/maps/arena3.glb
 */
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { ARENA3_MAP_PATHS } from "../../game/mapgen";
import { useGame } from "../../game/store";
import { EM } from "../../game/entities";

function useArena3Url(): string {
  // Prefer first path; drei caches by URL
  return ARENA3_MAP_PATHS[0];
}

export function Arena3Map() {
  const mapSize = useGame((s) => s.mapSize);
  const mapVersion = useGame((s) => s.mapVersion);
  const url = useArena3Url();
  const [failed, setFailed] = useState(false);

  if (mapSize !== "royale" || failed) return null;

  return (
    <Arena3Mesh
      key={`arena3-${mapVersion}`}
      url={url}
      onError={() => setFailed(true)}
    />
  );
}

function Arena3Mesh({ url, onError }: { url: string; onError: () => void }) {
  const gltf = useGLTF(url, true, true, (loader) => {
    loader.manager.onError = () => onError();
  });

  const scene = useMemo(() => {
    try {
      const root = gltf.scene.clone(true);
      root.name = "arena3-map";
      // Fit pack to procedural map footprint
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      root.position.x -= center.x;
      root.position.z -= center.z;
      root.position.y -= box.min.y;

      const m = EM.map;
      const targetW = m.width * 0.92;
      const targetL = m.length * 0.92;
      const sx = targetW / Math.max(size.x, 1);
      const sz = targetL / Math.max(size.z, 1);
      const s = Math.min(sx, sz);
      root.scale.setScalar(s);
      root.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(root);
      root.position.y -= box2.min.y;
      // Sit slightly under procedural terrain accents
      root.position.y -= 0.05;

      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
      });
      return root;
    } catch {
      onError();
      return null;
    }
  }, [gltf, onError]);

  useEffect(() => {
    return () => {
      scene?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose?.();
      });
    };
  }, [scene]);

  if (!scene) return null;
  return <primitive object={scene} />;
}

// Preload for faster match start when royale selected
try {
  useGLTF.preload(ARENA3_MAP_PATHS[0]);
} catch {
  /* optional */
}
