import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { EM } from "../../game/entities";

// Capped blade count for the whole field. Blades far from the camera are shrunk
// to nothing in the vertex shader (radius cull), so density only "costs" near
// the hero while the instance count stays fixed.
const COUNT = 7000;
const CULL_NEAR = 26;
const CULL_FAR = 34;
const RIDGE_SKIP = 1.0; // skip terrain above this height (ridges read as bare rock)
const BASE_CLEAR = 12; // keep grass off the Citadel footprints
const PATH_CLEAR = 3.4; // keep grass off the bare lane / cut-through corridors

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);

/**
 * Instanced, wind-animated ground grass. Adapted from the CodePen grass demo's
 * technique (per-vertex bend by blade height + time-based sway), reworked for an
 * R3F InstancedMesh with a MeshStandardMaterial patched via onBeforeCompile so it
 * still receives scene lighting/fog. Placed only on low/walkable terrain (skips
 * ridges + bases); rebuilt only when the map regenerates.
 */
export function Grass() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const ver = useRef("");
  const uniforms = useRef({
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
  });

  const { geo, mat, phases } = useMemo(() => {
    const blade = new THREE.PlaneGeometry(0.13, 0.95, 1, 4);
    blade.translate(0, 0.475, 0);
    const phases = new Float32Array(COUNT);
    const m = new THREE.MeshStandardMaterial({
      color: "#4f7d3a",
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.current.uTime;
      shader.uniforms.uCam = uniforms.current.uCam;
      shader.vertexShader =
        "uniform float uTime;\nuniform vec3 uCam;\nattribute float aPhase;\nvarying float vBend;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vBend = uv.y;
         float bend = uv.y * uv.y;
         vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
         float wind = sin(uTime * 1.7 + aPhase + iPos.x * 0.25 + iPos.z * 0.2);
         float gust = sin(uTime * 0.55 + iPos.x * 0.05) * 0.5;
         transformed.x += (wind + gust) * bend * 0.38;
         transformed.z += (wind * 0.6) * bend * 0.26;
         float d = distance(iPos.xz, uCam.xz);
         float cull = 1.0 - smoothstep(${CULL_NEAR.toFixed(1)}, ${CULL_FAR.toFixed(1)}, d);
         transformed *= cull;`,
      );
      shader.fragmentShader = "varying float vBend;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         diffuseColor.rgb *= mix(0.5, 1.15, vBend);`,
      );
    };
    return { geo: blade, mat: m, phases };
  }, []);

  useEffect(() => {
    geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat, phases]);

  const rebuild = () => {
    const mesh = ref.current;
    if (!mesh) return;
    const map = EM.map;
    let placed = 0;
    let attempts = 0;
    const maxAttempts = COUNT * 5;
    while (placed < COUNT && attempts < maxAttempts) {
      attempts++;
      const x = (Math.random() - 0.5) * (map.width - 2);
      const z = (Math.random() - 0.5) * (map.length - 2);
      const h = map.heightAt(x, z);
      if (h > RIDGE_SKIP) continue; // skip ridges
      if (!map.grid.isWalkableWorld(x, z)) continue; // low/walkable ground only
      if (map.distToPath(x, z) < PATH_CLEAR) continue; // skip bare lane corridors
      if (Math.hypot(x, z - map.allyCore.z) < BASE_CLEAR) continue;
      if (Math.hypot(x, z - map.enemyCore.z) < BASE_CLEAR) continue;
      _p.set(x, h, z);
      _q.setFromAxisAngle(_UP, Math.random() * Math.PI * 2);
      const sc = 0.7 + Math.random() * 0.8;
      _s.set(sc, sc * (0.8 + Math.random() * 0.7), sc);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(placed, _m);
      phases[placed] = Math.random() * Math.PI * 2;
      placed++;
    }
    for (let k = placed; k < COUNT; k++) {
      _m.makeScale(0, 0, 0);
      mesh.setMatrixAt(k, _m);
      phases[k] = 0;
    }
    mesh.instanceMatrix.needsUpdate = true;
    const attr = mesh.geometry.getAttribute("aPhase") as THREE.InstancedBufferAttribute | undefined;
    if (attr) attr.needsUpdate = true;
  };

  useFrame((state, dtRaw) => {
    uniforms.current.uTime.value += Math.min(0.05, dtRaw);
    uniforms.current.uCam.value.copy(state.camera.position);
    const key = `${EM.map.seed}:${EM.map.size}`;
    if (key !== ver.current) {
      ver.current = key;
      rebuild();
    }
  });

  return (
    <instancedMesh ref={ref} args={[geo, mat, COUNT]} frustumCulled={false} receiveShadow />
  );
}
