/**
 * Cheap gradient sky dome for battle — no HDRI, no water horizon.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { useGame } from "../../game/store";
import { getBattleTheme } from "../../game/battleThemes";

export function BattleSkybox() {
  const themeId = useGame((s) => s.battleTheme);
  const theme = getBattleTheme(themeId);

  const { geo, mat } = useMemo(() => {
    const geo = new THREE.SphereGeometry(380, 24, 16);
    geo.scale(-1, 1, 1);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(theme.skyTop) },
        horizonColor: { value: new THREE.Color(theme.skyHorizon) },
        offset: { value: 0.12 },
        exponent: { value: 0.65 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset * 380.0, 0.0)).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);
          gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
        }
      `,
    });
    return { geo, mat };
  }, [theme.skyTop, theme.skyHorizon]);

  return (
    <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={-10} />
  );
}
