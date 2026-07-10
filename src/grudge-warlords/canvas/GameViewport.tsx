/**
 * R3F Canvas shell — mirrors patched sgA / TK node (gw-game-viewport).
 * threejs-fundamentals + @react-three/fiber best practices.
 */
import { Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap } from "three";

export type GameViewportProps = {
  children: ReactNode;
  onCreated?: (state: { gl: { setPixelRatio: (n: number) => void } }) => void;
};

export function GameViewport({ children, onCreated }: GameViewportProps) {
  return (
    <div className="gw-game-viewport">
      <Canvas
        className="gw-game-canvas"
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
        resize={{ scroll: false, offsetSize: true }}
        shadows={{ type: PCFSoftShadowMap }}
        camera={{ fov: 72, near: 0.22, far: 420, position: [0, 13, 44] }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
          alpha: false,
        }}
        dpr={[1, 1.5]}
        onCreated={(state) => {
          state.gl.toneMapping = ACESFilmicToneMapping;
          onCreated?.(state);
        }}
      >
        <color attach="background" args={["#6e5240"]} />
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}