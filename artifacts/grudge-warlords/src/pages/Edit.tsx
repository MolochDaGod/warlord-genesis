/**
 * /edit ΓÇö Warlord Genesis Map Scale + Pathfinding Route Studio
 *
 * Choose map size/seed, scale terrain / towers / buildings / trees / props,
 * pick pathfinding mode (grid A* / flow / auto), draw routes from structure
 * bottom ┬╖ mid ┬╖ top on the terrain mesh.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  generateMap,
  MAP_SIZES,
  type GameMap,
  type MapSize,
} from "../game/mapgen";
import { findPath } from "../game/pathfind";
import {
  loadPrefs,
  savePrefs,
  resolveScales,
  SCALE_META,
  type MapEditPrefs,
  type ScaleKey,
  type PathfindingMode,
  type AnchorLevel,
  type MapEditScales,
} from "../game/mapEditStore";

const LAYER_COLOR: Record<AnchorLevel, string> = {
  bottom: "#f59e0b",
  mid: "#38bdf8",
  top: "#e879f9",
};

type Structure = {
  id: string;
  kind: "tower" | "building" | "core";
  x: number;
  z: number;
  baseH: number;
  baseW: number;
  label: string;
};

function structuresFromMap(m: GameMap): Structure[] {
  const out: Structure[] = [];
  out.push({
    id: "ally_core",
    kind: "core",
    x: m.allyCore.x,
    z: m.allyCore.z,
    baseH: 14,
    baseW: 12,
    label: "Ally Citadel",
  });
  out.push({
    id: "enemy_core",
    kind: "core",
    x: m.enemyCore.x,
    z: m.enemyCore.z,
    baseH: 14,
    baseW: 12,
    label: "Enemy Citadel",
  });
  m.towers.forEach((t, i) => {
    out.push({
      id: `tower_${t.faction}_${t.lane}_${t.tier}_${i}`,
      kind: "tower",
      x: t.x,
      z: t.z,
      baseH: t.tier === "outer" ? 9 : 11,
      baseW: 5.5,
      label: `${t.faction} ${t.tier} L${t.lane}`,
    });
  });
  m.buildings.forEach((b, i) => {
    out.push({
      id: `bld_${b.faction}_${b.kind}_${b.lane}_${i}`,
      kind: "building",
      x: b.x,
      z: b.z,
      baseH: 6.5,
      baseW: 8,
      label: `${b.faction} ${b.kind} L${b.lane}`,
    });
  });
  return out;
}

function TerrainMesh({
  map,
  terrainScale,
}: {
  map: GameMap;
  terrainScale: number;
}) {
  const geom = useMemo(() => {
    const { hmCols: cols, hmRows: rows, heights, width, length } = map;
    const halfW = width / 2;
    const halfL = length / 2;
    const positions = new Float32Array(cols * rows * 3);
    const colors = new Float32Array(cols * rows * 3);
    const low = new THREE.Color("#2d4a28");
    const high = new THREE.Color("#6b8f4e");
    const tmp = new THREE.Color();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = -halfW + (c / (cols - 1)) * width;
        const z = -halfL + (r / (rows - 1)) * length;
        const h = heights[i] * terrainScale;
        positions[i * 3] = x;
        positions[i * 3 + 1] = h;
        positions[i * 3 + 2] = z;
        tmp.copy(low).lerp(high, Math.min(1, heights[i] / 4));
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }
    }
    const indices: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = r * cols + c + 1;
        const d = (r + 1) * cols + c;
        const e = (r + 1) * cols + c + 1;
        indices.push(a, d, b, b, d, e);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [map, terrainScale]);

  return (
    <mesh geometry={geom} receiveShadow castShadow={false}>
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

function StructureMesh({
  s,
  map,
  scales,
}: {
  s: Structure;
  map: GameMap;
  scales: MapEditScales;
}) {
  const layer =
    s.kind === "tower" ? scales.towers : s.kind === "core" ? scales.buildings : scales.buildings;
  const h = s.baseH * layer;
  const w = s.baseW * layer;
  const y0 = map.heightAt(s.x, s.z) * scales.terrain;
  const color =
    s.kind === "tower" ? "#6b7280" : s.kind === "core" ? "#a16207" : "#8b7355";

  return (
    <group position={[s.x, y0, s.z]} scale={[1, 1, 1]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, w * 0.88]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      {s.kind === "tower" && (
        <mesh position={[0, h + h * 0.08, 0]} castShadow>
          <cylinderGeometry args={[w * 0.12, w * 0.28, h * 0.18, 8]} />
          <meshStandardMaterial color="#44403c" />
        </mesh>
      )}
      {/* Anchor markers */}
      {(["bottom", "mid", "top"] as AnchorLevel[]).map((lvl) => {
        const t = lvl === "bottom" ? 0.04 : lvl === "mid" ? 0.5 : 1;
        return (
          <mesh key={lvl} position={[0, h * t, 0]}>
            <sphereGeometry args={[0.35, 10, 10]} />
            <meshBasicMaterial color={LAYER_COLOR[lvl]} />
          </mesh>
        );
      })}
    </group>
  );
}

function TreesLayer({ map, scales }: { map: GameMap; scales: MapEditScales }) {
  return (
    <group>
      {map.trees.slice(0, 120).map((t, i) => {
        const y = map.heightAt(t.x, t.z) * scales.terrain;
        const s = t.scale * scales.trees;
        return (
          <group key={i} position={[t.x, y, t.z]} rotation={[0, t.rot, 0]} scale={s}>
            <mesh position={[0, 1.2, 0]} castShadow>
              <cylinderGeometry args={[0.25, 0.4, 2.4, 6]} />
              <meshStandardMaterial color="#5c4033" />
            </mesh>
            <mesh position={[0, 3.4, 0]} castShadow>
              <coneGeometry args={[1.6, 3.2, 7]} />
              <meshStandardMaterial color="#1f6b34" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function LanesOverlay({ map, scales }: { map: GameMap; scales: MapEditScales }) {
  return (
    <group>
      {map.lanes.map((lane) => {
        const pts = lane.pts.map(
          (p) =>
            new THREE.Vector3(
              p.x,
              map.heightAt(p.x, p.z) * scales.terrain + 0.25,
              p.z,
            ),
        );
        return (
          <Line
            key={lane.id}
            points={pts}
            color="#94a3b8"
            lineWidth={1.5}
            transparent
            opacity={0.55}
          />
        );
      })}
    </group>
  );
}

function NavGridOverlay({ map, scales }: { map: GameMap; scales: MapEditScales }) {
  const points = useMemo(() => {
    const g = map.grid;
    const pts: THREE.Vector3[] = [];
    const step = 3;
    for (let r = 0; r < g.rows; r += step) {
      for (let c = 0; c < g.cols; c += step) {
        if (!g.isWalkableCell(c, r)) continue;
        const x = g.worldX(c);
        const z = g.worldZ(r);
        const y = map.heightAt(x, z) * scales.terrain + 0.15;
        pts.push(new THREE.Vector3(x, y, z));
      }
    }
    return pts;
  }, [map, scales.terrain]);

  const positions = useMemo(
    () => new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])),
    [points],
  );

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial color="#22c55e" size={0.55} sizeAttenuation transparent opacity={0.55} />
    </points>
  );
}

function RouteLines({
  map,
  scales,
  from,
  to,
  layers,
  mode,
}: {
  map: GameMap;
  scales: MapEditScales;
  from: Structure;
  to: Structure;
  layers: AnchorLevel[];
  mode: PathfindingMode;
}) {
  const routes = useMemo(() => {
    const out: { level: AnchorLevel; pts: THREE.Vector3[]; source: string }[] = [];
    const xzPath = (() => {
      if (mode === "flow") {
        // Sample flow field toward destination structure as pseudo-path
        const field =
          to.id.includes("enemy") || to.kind === "core" && to.id.startsWith("enemy")
            ? map.flowToEnemyCore
            : to.id.includes("ally")
              ? map.flowToAllyCore
              : map.flowToEnemyCore;
        const pts: { x: number; z: number }[] = [];
        let x = from.x;
        let z = from.z;
        const dir = { x: 0, z: 0 };
        for (let i = 0; i < 200; i++) {
          pts.push({ x, z });
          const ok = field.sampleDir(x, z, dir);
          if (!ok || (Math.abs(dir.x) < 1e-4 && Math.abs(dir.z) < 1e-4)) break;
          x += dir.x * 2.2;
          z += dir.z * 2.2;
          if (Math.hypot(x - to.x, z - to.z) < 3) {
            pts.push({ x: to.x, z: to.z });
            break;
          }
        }
        return { pts, source: "flow" as const };
      }
      const path = findPath(map.grid, from.x, from.z, to.x, to.z);
      if (path && path.length) {
        return {
          pts: [{ x: from.x, z: from.z }, ...path],
          source: "grid" as const,
        };
      }
      // straight fallback
      const pts: { x: number; z: number }[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        pts.push({
          x: THREE.MathUtils.lerp(from.x, to.x, t),
          z: THREE.MathUtils.lerp(from.z, to.z, t),
        });
      }
      return { pts, source: "straight" as const };
    })();

    for (const level of layers) {
      const layerScale =
        from.kind === "tower" ? scales.towers : scales.buildings;
      const layerScaleTo = to.kind === "tower" ? scales.towers : scales.buildings;
      const t = level === "bottom" ? 0.04 : level === "mid" ? 0.5 : 1;
      const fromH = from.baseH * layerScale * t;
      const toH = to.baseH * layerScaleTo * t;
      const gFrom = map.heightAt(from.x, from.z) * scales.terrain;
      const gTo = map.heightAt(to.x, to.z) * scales.terrain;
      const fromA = new THREE.Vector3(from.x, gFrom + fromH, from.z);
      const toA = new THREE.Vector3(to.x, gTo + toH, to.z);
      const lift = scales.routeLift;
      const groundPts = xzPath.pts.map((p) => {
        const y = map.heightAt(p.x, p.z) * scales.terrain + lift;
        return new THREE.Vector3(p.x, y, p.z);
      });
      const full = [
        fromA,
        groundPts[0] ?? fromA.clone(),
        ...groundPts.slice(1, -1),
        groundPts[groundPts.length - 1] ?? toA.clone(),
        toA,
      ];
      out.push({ level, pts: full, source: xzPath.source });
    }
    return out;
  }, [map, scales, from, to, layers, mode]);

  return (
    <group>
      {routes.map((r) => (
        <Line
          key={r.level}
          points={r.pts}
          color={LAYER_COLOR[r.level]}
          lineWidth={2.5}
          transparent
          opacity={0.95}
        />
      ))}
    </group>
  );
}

function CameraFrame({ map }: { map: GameMap }) {
  const { camera } = useThree();
  useEffect(() => {
    const d = Math.max(map.width, map.length) * 0.55;
    camera.position.set(d * 0.55, d * 0.45, d * 0.7);
    camera.lookAt(0, 0, 0);
  }, [camera, map]);
  return null;
}

function SceneBody({
  map,
  scales,
  structures,
  fromId,
  toId,
  layers,
  mode,
  showNav,
  showLanes,
}: {
  map: GameMap;
  scales: MapEditScales;
  structures: Structure[];
  fromId: string;
  toId: string;
  layers: AnchorLevel[];
  mode: PathfindingMode;
  showNav: boolean;
  showLanes: boolean;
}) {
  const from = structures.find((s) => s.id === fromId);
  const to = structures.find((s) => s.id === toId);

  return (
    <>
      <color attach="background" args={["#0a1020"]} />
      <fog attach="fog" args={["#0a1020", 180, 520]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#b8d4ff", "#3a2a18", 0.7]} />
      <directionalLight
        castShadow
        intensity={1.1}
        position={[80, 140, 60]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <CameraFrame map={map} />
      <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI * 0.48} />
      <TerrainMesh map={map} terrainScale={scales.terrain} />
      {structures.map((s) => (
        <StructureMesh key={s.id} s={s} map={map} scales={scales} />
      ))}
      <TreesLayer map={map} scales={scales} />
      {showLanes && <LanesOverlay map={map} scales={scales} />}
      {showNav && <NavGridOverlay map={map} scales={scales} />}
      {from && to && layers.length > 0 && (
        <RouteLines
          map={map}
          scales={scales}
          from={from}
          to={to}
          layers={layers}
          mode={mode}
        />
      )}
      {/* water plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#0c3a6e" transparent opacity={0.75} roughness={0.3} />
      </mesh>
    </>
  );
}

export function Edit() {
  const [prefs, setPrefs] = useState<MapEditPrefs>(() => loadPrefs());
  const [status, setStatus] = useState("Ready");
  const [drawKey, setDrawKey] = useState(0);
  const [fromId, setFromId] = useState("ally_core");
  const [toId, setToId] = useState("enemy_core");
  const [scope, setScope] = useState<"global" | "map">("global");

  const map = useMemo(
    () => generateMap(prefs.seed, prefs.mapSize),
    [prefs.seed, prefs.mapSize],
  );
  const scales = useMemo(() => resolveScales(prefs), [prefs]);
  const structures = useMemo(() => structuresFromMap(map), [map]);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    // default endpoints when map changes
    setFromId("ally_core");
    setToId("enemy_core");
    setStatus(
      `Map ${prefs.mapSize} ┬╖ seed ${prefs.seed.toString(16)} ┬╖ towers=${map.towers.length} buildings=${map.buildings.length}`,
    );
  }, [map, prefs.mapSize, prefs.seed]);

  const setScale = (key: ScaleKey, value: number) => {
    setPrefs((p) => {
      if (scope === "map") {
        return {
          ...p,
          bySize: {
            ...p.bySize,
            [p.mapSize]: { ...p.bySize[p.mapSize], [key]: value },
          },
        };
      }
      return { ...p, scales: { ...p.scales, [key]: value } };
    });
  };

  const activeLayers = (Object.keys(prefs.layers) as AnchorLevel[]).filter(
    (k) => prefs.layers[k],
  );

  const draw = () => {
    setDrawKey((k) => k + 1);
    setStatus(`Routes drawn ┬╖ ${activeLayers.join("+") || "none"} ┬╖ mode=${prefs.pathfinding}`);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        background: "#070b14",
        color: "#e2e8f0",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <Canvas shadows camera={{ fov: 50, near: 0.5, far: 2000 }} style={{ width: "100%", height: "100%" }}>
          <SceneBody
            key={`${prefs.mapSize}-${prefs.seed}-${drawKey}`}
            map={map}
            scales={scales}
            structures={structures}
            fromId={fromId}
            toId={toId}
            layers={activeLayers}
            mode={prefs.pathfinding}
            showNav={prefs.showNavGrid}
            showLanes={prefs.showLanes}
          />
        </Canvas>
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <Link
            to="/play"
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.55)",
              color: "#e2e8f0",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            ΓåÉ Play
          </Link>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: "rgba(245,158,11,0.2)",
              border: "1px solid rgba(245,158,11,0.45)",
              color: "#fde68a",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            /edit ┬╖ Map Scale + Routes
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            maxWidth: 480,
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
            background: "rgba(0,0,0,0.65)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#94a3b8",
          }}
        >
          {status}
        </div>
      </div>

      <aside
        style={{
          width: 340,
          maxWidth: "42vw",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(12,18,32,0.96)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Map Edit Studio</h1>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
            Scale terrain & meshes, choose pathfinding, draw bottom / mid / top routes
            on the battlefield mesh.
          </p>
        </header>

        <section style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <label style={lab}>Map size</label>
          <select
            style={sel}
            value={prefs.mapSize}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, mapSize: e.target.value as MapSize }))
            }
          >
            {(Object.keys(MAP_SIZES) as MapSize[]).map((id) => (
              <option key={id} value={id}>
                {MAP_SIZES[id].label} ({MAP_SIZES[id].width}├ù{MAP_SIZES[id].length}m)
              </option>
            ))}
          </select>
          <label style={{ ...lab, marginTop: 10 }}>Seed</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              style={{ ...sel, flex: 1 }}
              type="text"
              value={prefs.seed.toString(16)}
              onChange={(e) => {
                const n = parseInt(e.target.value, 16);
                if (!Number.isNaN(n)) setPrefs((p) => ({ ...p, seed: n >>> 0 }));
              }}
            />
            <button
              type="button"
              style={btn}
              onClick={() =>
                setPrefs((p) => ({
                  ...p,
                  seed: (Math.random() * 0xffffffff) >>> 0,
                }))
              }
            >
              ≡ƒÄ▓
            </button>
          </div>
        </section>

        <section style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={lab}>Layer scales (SI)</label>
            <div style={{ display: "flex", gap: 4 }}>
              {(["global", "map"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  style={{
                    ...btn,
                    fontSize: 10,
                    background:
                      scope === s ? "rgba(245,158,11,0.25)" : "transparent",
                    borderColor:
                      scope === s ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.12)",
                  }}
                >
                  {s === "global" ? "All maps" : "This size"}
                </button>
              ))}
            </div>
          </div>
          {(Object.keys(SCALE_META) as ScaleKey[]).map((key) => {
            const meta = SCALE_META[key];
            const val = scales[key];
            return (
              <div key={key} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    marginBottom: 4,
                  }}
                >
                  <span>{meta.label}</span>
                  <span style={{ color: "#fde68a", fontFamily: "monospace" }}>
                    {val.toFixed(2)}├ù
                  </span>
                </div>
                <input
                  type="range"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={val}
                  onChange={(e) => setScale(key, Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            );
          })}
        </section>

        <section style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <label style={lab}>Pathfinding</label>
          {(
            [
              ["auto", "Auto", "Grid A* (primary)"],
              ["grid", "Grid A*", "WalkGrid findPath on lanes/bases"],
              ["flow", "Flow field", "Shared Dijkstra flow toward core"],
            ] as const
          ).map(([id, title, hint]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPrefs((p) => ({ ...p, pathfinding: id }))}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                marginBottom: 6,
                padding: "8px 10px",
                borderRadius: 6,
                border:
                  prefs.pathfinding === id
                    ? "1px solid rgba(56,189,248,0.45)"
                    : "1px solid rgba(255,255,255,0.1)",
                background:
                  prefs.pathfinding === id
                    ? "rgba(56,189,248,0.12)"
                    : "transparent",
                color: "#e2e8f0",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{hint}</div>
            </button>
          ))}
          <label style={{ ...lab, display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input
              type="checkbox"
              checked={prefs.showNavGrid}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, showNavGrid: e.target.checked }))
              }
            />
            Show walkable grid samples
          </label>
          <label style={{ ...lab, display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={prefs.showLanes}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, showLanes: e.target.checked }))
              }
            />
            Show lane polylines
          </label>
        </section>

        <section style={{ padding: 16, flex: 1 }}>
          <label style={lab}>Draw routes on terrain</label>
          <p style={{ fontSize: 10, color: "#64748b", margin: "4px 0 10px", lineHeight: 1.4 }}>
            Path XZ from pathfinding; Y on terrain + lift. Vertical stubs from structure{" "}
            <span style={{ color: LAYER_COLOR.bottom }}>bottom</span> /{" "}
            <span style={{ color: LAYER_COLOR.mid }}>mid</span> /{" "}
            <span style={{ color: LAYER_COLOR.top }}>top</span>.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={lab}>From</label>
              <select style={sel} value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lab}>To</label>
              <select style={sel} value={toId} onChange={(e) => setToId(e.target.value)}>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {(["bottom", "mid", "top"] as AnchorLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() =>
                  setPrefs((p) => ({
                    ...p,
                    layers: { ...p.layers, [lvl]: !p.layers[lvl] },
                  }))
                }
                style={{
                  ...btn,
                  textTransform: "capitalize",
                  borderColor: prefs.layers[lvl] ? LAYER_COLOR[lvl] : "rgba(255,255,255,0.12)",
                  color: prefs.layers[lvl] ? LAYER_COLOR[lvl] : "#64748b",
                  background: prefs.layers[lvl]
                    ? `${LAYER_COLOR[lvl]}22`
                    : "transparent",
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={draw}
            disabled={fromId === toId}
            style={{
              ...btn,
              width: "100%",
              marginTop: 12,
              background: "#d97706",
              borderColor: "#d97706",
              color: "#000",
              fontWeight: 700,
              padding: "10px 12px",
            }}
          >
            Draw route layers
          </button>
        </section>

        <footer
          style={{
            padding: 12,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            fontSize: 10,
            color: "#64748b",
          }}
        >
          Prefs saved locally ┬╖ warlord-genesis.vercel.app/edit
        </footer>
      </aside>
    </div>
  );
}

const lab: CSSProperties = {
  display: "block",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
  marginBottom: 4,
};

const sel: CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  padding: "6px 8px",
  color: "#e2e8f0",
  fontSize: 12,
};

const btn: CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  padding: "4px 8px",
  color: "#e2e8f0",
  cursor: "pointer",
  fontSize: 12,
};

export default Edit;
