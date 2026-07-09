import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, Html, useGLTF } from "@react-three/drei";
import {
  attachWebGLContextGuard,
  fleetWorldCanvasProps,
  withFleetCanvasProps,
} from "@workspace/r3f-fleet";
import * as THREE from "three";
import {
  FACTION_TERRITORIES,
  SECTOR_SIZE,
  channelGates,
  clampToSector,
  detectSectorTransition,
  islandsInSector,
  sectorBounds,
  sectorMeta,
  shipsInSector,
  shipGlbForType,
  TI_PLAYER_SHIP_GLB,
  type ChannelGate,
  type EnemyShipData,
  type Faction,
  type WorldIslandData,
} from "@workspace/world-content";
import { sectorBanner, useSailing } from "@/game/sailingStore";

const FACTION_ISLAND_COLOR: Record<Faction, string> = {
  crusade: "#3b82f6",
  fabled: "#22c55e",
  legion: "#ef4444",
  neutral: "#94a3b8",
  pirate: "#475569",
};

const SIZE_HEIGHT: Record<WorldIslandData["size"], number> = {
  small: 18,
  medium: 28,
  large: 42,
  capital: 58,
};

const SHIP_SPEED = 95;
const TURN_SPEED = 2.2;
const TRANSITION_COOLDOWN = 1.2;

function ShipHull({
  url,
  scale = 1,
  ghost = false,
}: {
  url: string;
  scale?: number;
  ghost?: boolean;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const s = scene.clone(true);
    if (ghost) {
      s.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.transparent = true;
          mat.opacity = 0.72;
        }
      });
    }
    return s;
  }, [scene, ghost]);

  return <primitive object={cloned} scale={scale} rotation={[0, Math.PI, 0]} />;
}

function ShipFallback({ color, ghost }: { color: string; ghost?: boolean }) {
  return (
    <mesh castShadow>
      <boxGeometry args={[10, 4, 22]} />
      <meshStandardMaterial
        color={color}
        emissive={ghost ? "#334455" : "#000000"}
        emissiveIntensity={ghost ? 0.5 : 0}
        transparent={ghost}
        opacity={ghost ? 0.75 : 1}
      />
    </mesh>
  );
}

function Ocean({ cx, cz }: { cx: number; cz: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = 0.15 + Math.sin(clock.elapsedTime * 0.4) * 0.05;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[cx, -2, cz]} receiveShadow>
      <planeGeometry args={[SECTOR_SIZE + 80, SECTOR_SIZE + 80]} />
      <meshStandardMaterial color="#0c2a44" emissive="#061828" roughness={0.35} metalness={0.1} />
    </mesh>
  );
}

function SectorBorder({ sx, sz }: { sx: number; sz: number }) {
  const b = sectorBounds(sx, sz);
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  return (
    <mesh position={[b.centerX, 0.3, b.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[Math.min(w, d) * 0.48, Math.min(w, d) * 0.5, 4]} />
      <meshBasicMaterial color="#1a3048" transparent opacity={0.35} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ChannelMarker({ gate, sx, sz }: { gate: ChannelGate; sx: number; sz: number }) {
  const b = sectorBounds(sx, sz);
  const isEW = gate.dir === "east" || gate.dir === "west";
  const length = gate.span;
  const depth = 90;
  let px = gate.cx;
  let pz = gate.cz;
  let rotY = 0;
  let scaleX = 1;
  let scaleZ = 1;

  if (gate.dir === "east") {
    px = b.maxX - depth * 0.5;
    scaleX = depth / length;
    scaleZ = length / 200;
    rotY = 0;
  } else if (gate.dir === "west") {
    px = b.minX + depth * 0.5;
    scaleX = depth / length;
    scaleZ = length / 200;
    rotY = 0;
  } else if (gate.dir === "north") {
    pz = b.minZ + depth * 0.5;
    scaleZ = depth / length;
    scaleX = length / 200;
    rotY = Math.PI / 2;
  } else {
    pz = b.maxZ - depth * 0.5;
    scaleZ = depth / length;
    scaleX = length / 200;
    rotY = Math.PI / 2;
  }

  return (
    <group position={[px, 0.8, pz]} rotation={[0, rotY, 0]}>
      <mesh scale={[scaleX, 1, scaleZ]}>
        <boxGeometry args={[200, 0.6, 40]} />
        <meshStandardMaterial
          color="#2a8fc7"
          emissive="#0e4a6e"
          emissiveIntensity={0.55}
          transparent
          opacity={0.72}
        />
      </mesh>
      {gate.neighbor && (
        <Html
          position={[0, 12, 0]}
          center
          distanceFactor={320}
          style={{
            pointerEvents: "none",
            color: "#7dd3fc",
            fontSize: "10px",
            fontFamily: "Inter, sans-serif",
            textShadow: "0 1px 3px #000",
            whiteSpace: "nowrap",
          }}
        >
          ⛵ {gate.neighbor.name}
        </Html>
      )}
    </group>
  );
}

function TerritoryRings({ sx, sz }: { sx: number; sz: number }) {
  const entries = useMemo(() => {
    const b = sectorBounds(sx, sz);
    return Object.entries(FACTION_TERRITORIES).filter(([, t]) => {
      return t.center.x >= b.minX && t.center.x <= b.maxX && t.center.z >= b.minZ && t.center.z <= b.maxZ;
    });
  }, [sx, sz]);

  return (
    <group>
      {entries.map(([faction, t]) => (
        <mesh
          key={faction}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[t.center.x, 0.5, t.center.z]}
        >
          <ringGeometry args={[t.radius * 0.85, t.radius, 64]} />
          <meshBasicMaterial
            color={new THREE.Color(t.color)}
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function IslandMarker({ island }: { island: WorldIslandData }) {
  const h = SIZE_HEIGHT[island.size];
  const color = FACTION_ISLAND_COLOR[island.faction];
  return (
    <group position={[island.position.x, 0, island.position.z]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[island.radius * 0.55, island.radius * 0.7, h, 12]} />
        <meshStandardMaterial color={color} roughness={0.75} metalness={0.05} />
      </mesh>
      <mesh position={[0, h * 0.55, 0]} castShadow>
        <coneGeometry args={[island.radius * 0.35, h * 0.45, 8]} />
        <meshStandardMaterial color="#1a2e1a" roughness={0.9} />
      </mesh>
      {island.size === "capital" && (
        <mesh position={[0, h + 12, 0]}>
          <octahedronGeometry args={[8, 0]} />
          <meshStandardMaterial color="#d4b06a" emissive="#5a4020" emissiveIntensity={0.4} />
        </mesh>
      )}
      <Html
        position={[0, h + 22, 0]}
        center
        distanceFactor={220}
        style={{
          pointerEvents: "none",
          color: "#e8dcc8",
          fontSize: "11px",
          fontFamily: "Cinzel, serif",
          textShadow: "0 1px 4px #000",
          whiteSpace: "nowrap",
        }}
      >
        {island.name}
      </Html>
    </group>
  );
}

function PatrolShip({ ship }: { ship: EnemyShipData }) {
  const group = useRef<THREE.Group>(null);
  const color = ship.aggressive ? "#ff6b55" : FACTION_ISLAND_COLOR[ship.faction];
  const scale = ship.shipType === "large" ? 1.4 : ship.shipType === "ghost" ? 1.1 : 1;
  const phase = useMemo(() => ship.id.length * 0.7, [ship.id]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const angle = clock.elapsedTime * 0.08 + phase;
    g.position.set(
      ship.patrolCenter.x + Math.cos(angle) * ship.patrolRadius * 0.6,
      2,
      ship.patrolCenter.z + Math.sin(angle) * ship.patrolRadius * 0.6,
    );
    g.rotation.y = -angle;
  });

  const glb = shipGlbForType(ship.shipType, ship.faction);
  const isGhost = ship.shipType === "ghost";

  return (
    <group ref={group} scale={scale}>
      <Suspense fallback={<ShipFallback color={color} ghost={isGhost} />}>
        <ShipHull url={glb} scale={ship.shipType === "large" ? 2.2 : 1.8} ghost={isGhost} />
      </Suspense>
    </group>
  );
}

function PlayerShip({
  onDockReady,
}: {
  onDockReady: (island: WorldIslandData | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const cooldown = useRef(0);
  const { x, z, yaw, sector, setPose, setSector } = useSailing();

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, dt) => {
    cooldown.current = Math.max(0, cooldown.current - dt);

    const k = keys.current;
    let turn = 0;
    if (k.has("a") || k.has("arrowleft")) turn += 1;
    if (k.has("d") || k.has("arrowright")) turn -= 1;

    let nyaw = yaw + turn * TURN_SPEED * dt;
    let spd = 0;
    if (k.has("w") || k.has("arrowup")) spd = SHIP_SPEED;
    if (k.has("s") || k.has("arrowdown")) spd = -SHIP_SPEED * 0.45;

    let nxp = x + Math.sin(nyaw) * spd * dt;
    let nzp = z + Math.cos(nyaw) * spd * dt;

    const clamped = clampToSector({ x: nxp, z: nzp }, sector);
    nxp = clamped.x;
    nzp = clamped.z;

    if (cooldown.current <= 0) {
      const hop = detectSectorTransition({ x: nxp, z: nzp }, sector);
      if (hop) {
        nxp = hop.newPos.x;
        nzp = hop.newPos.z;
        setSector(hop.to.sx, hop.to.sz, sectorBanner(hop.meta));
        cooldown.current = TRANSITION_COOLDOWN;
      }
    }

    if (nxp !== x || nzp !== z || nyaw !== yaw) setPose(nxp, nzp, nyaw);

    const g = group.current;
    if (g) {
      g.position.set(nxp, 3, nzp);
      g.rotation.y = nyaw;
    }

    const localIslands = islandsInSector(sector.sx, sector.sz);
    let dock: WorldIslandData | null = null;
    for (const island of localIslands) {
      const dx = nxp - island.position.x;
      const dz = nzp - island.position.z;
      if (Math.hypot(dx, dz) <= island.radius + 40) {
        dock = island;
        break;
      }
    }
    onDockReady(dock);
  });

  return (
    <group ref={group} position={[x, 3, z]} rotation={[0, yaw, 0]}>
      <Suspense
        fallback={
          <>
            <mesh castShadow>
              <boxGeometry args={[12, 5, 26]} />
              <meshStandardMaterial color="#d4b06a" emissive="#3d2c12" emissiveIntensity={0.25} />
            </mesh>
            <mesh position={[0, 8, -2]} castShadow>
              <boxGeometry args={[2, 14, 2]} />
              <meshStandardMaterial color="#5c4030" />
            </mesh>
          </>
        }
      >
        <ShipHull url={TI_PLAYER_SHIP_GLB} scale={2.4} />
      </Suspense>
    </group>
  );
}

function ChaseCamera() {
  const { camera } = useThree();
  const { x, z } = useSailing();
  useFrame(() => {
    const desired = new THREE.Vector3(x, 160, z + 110);
    camera.position.lerp(desired, 0.1);
    camera.lookAt(x, 0, z);
  });
  return null;
}

function SceneInner({ onDockReady }: { onDockReady: (island: WorldIslandData | null) => void }) {
  const { sector } = useSailing();
  const { sx, sz } = sector;
  const bounds = sectorBounds(sx, sz);
  const islands = useMemo(() => islandsInSector(sx, sz), [sx, sz]);
  const ships = useMemo(() => shipsInSector(sx, sz), [sx, sz]);
  const gates = useMemo(() => channelGates(sector), [sx, sz]);
  const meta = sectorMeta(sx, sz);

  return (
    <>
      <color attach="background" args={["#071018"]} />
      <fog attach="fog" args={["#071018", 280, 1600]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[bounds.centerX + 200, 500, bounds.centerZ - 100]} intensity={1.2} castShadow />
      <Ocean cx={bounds.centerX} cz={bounds.centerZ} />
      <SectorBorder sx={sx} sz={sz} />
      <TerritoryRings sx={sx} sz={sz} />
      {gates.map((g) => (
        <ChannelMarker key={g.dir} gate={g} sx={sx} sz={sz} />
      ))}
      {islands.map((island) => (
        <IslandMarker key={island.id} island={island} />
      ))}
      {ships.map((s) => (
        <PatrolShip key={s.id} ship={s} />
      ))}
      <PlayerShip onDockReady={onDockReady} />
      <ChaseCamera />
      <Html
        position={[bounds.minX + 120, 40, bounds.minZ + 80]}
        style={{
          pointerEvents: "none",
          color: "#d4b06a",
          fontFamily: "Cinzel, serif",
          fontSize: "14px",
          textShadow: "0 2px 6px #000",
        }}
      >
        {meta.name}
      </Html>
    </>
  );
}

export function WorldMapScene({
  onDockReady,
}: {
  onDockReady: (island: WorldIslandData | null) => void;
}) {
  const { sector } = useSailing();
  const key = `${sector.sx},${sector.sz}`;

  return (
    <Canvas
      key={key}
      {...withFleetCanvasProps(fleetWorldCanvasProps, {
        camera: { position: [220, 160, 330], fov: 50, near: 1, far: 5000 },
        style: { position: "absolute", inset: 0 },
        onCreated: (state) =>
          attachWebGLContextGuard(state.gl.domElement, "grudge-world"),
      })}
    >
      <AdaptiveDpr pixelated />
      <SceneInner onDockReady={onDockReady} />
    </Canvas>
  );
}