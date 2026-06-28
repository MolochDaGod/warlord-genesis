import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { NetStruct, NetUnit, SimMap, UnitKey } from "@workspace/gw-sim";
import { INTERP_DELAY_MS, runtime } from "../../../net/runtime";

const TEAM_COLOR: Record<number, number> = { 0: 0x5a86ff, 1: 0xff6a55 };

interface KindCfg {
  geo: THREE.BufferGeometry;
  yOff: number;
  barY: number;
  scale?: number;
}

const G = {
  hero: new THREE.CapsuleGeometry(0.6, 1.3, 4, 10),
  knight: new THREE.BoxGeometry(1.1, 1.4, 1.1),
  footman: new THREE.BoxGeometry(0.85, 1.1, 0.85),
  creepMelee: new THREE.BoxGeometry(0.7, 0.9, 0.7),
  archer: new THREE.ConeGeometry(0.5, 1.3, 6),
  creepRanged: new THREE.ConeGeometry(0.45, 1.1, 6),
  core: new THREE.OctahedronGeometry(3),
  tower: new THREE.CylinderGeometry(1.4, 1.8, 6, 8),
};

const UNIT_CFG: Record<UnitKey, KindCfg> = {
  hero: { geo: G.hero, yOff: 1.25, barY: 2.6 },
  knight: { geo: G.knight, yOff: 0.7, barY: 1.9 },
  footman: { geo: G.footman, yOff: 0.55, barY: 1.6 },
  creepMelee: { geo: G.creepMelee, yOff: 0.45, barY: 1.4 },
  archer: { geo: G.archer, yOff: 0.65, barY: 1.7 },
  creepRanged: { geo: G.creepRanged, yOff: 0.55, barY: 1.5 },
};

const STRUCT_CFG = {
  core: { geo: G.core, yOff: 3, barY: 7 },
  tower: { geo: G.tower, yOff: 3, barY: 7.5 },
};

const barGeo = new THREE.PlaneGeometry(1, 0.16);

function makeEntity(color: number, cfg: KindCfg, mine: boolean): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
    emissive: mine ? 0xffcc44 : 0x000000,
    emissiveIntensity: mine ? 0.5 : 0,
  });
  const body = new THREE.Mesh(cfg.geo, mat);
  body.position.y = cfg.yOff;
  body.userData["mat"] = mat;
  group.add(body);

  const barMat = new THREE.MeshBasicMaterial({ color: 0x6ad06a, depthTest: false });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.y = cfg.barY;
  bar.renderOrder = 999;
  bar.userData["mat"] = barMat;
  group.add(bar);
  group.userData["bar"] = bar;
  return group;
}

function setHp(group: THREE.Group, ratio: number, cam: THREE.Camera) {
  const bar = group.userData["bar"] as THREE.Mesh;
  const r = Math.max(0, Math.min(1, ratio));
  bar.scale.x = Math.max(0.001, r * 2.4);
  const mat = bar.userData["mat"] as THREE.MeshBasicMaterial;
  mat.color.setRGB(r > 0.5 ? (1 - r) * 2 : 1, r > 0.5 ? 1 : r * 2, 0.15);
  bar.quaternion.copy(cam.quaternion);
}

export function Entities({ map }: { map: SimMap }) {
  const { camera } = useThree();
  const rootRef = useRef<THREE.Group>(null);
  const units = useRef(new Map<number, THREE.Group>());
  const structs = useRef(new Map<number, THREE.Group>());
  // Smoothed display pose for the controlled hero. The authoritative prediction
  // (runtime.predict) updates at the snapshot rate; we lerp the rendered hero
  // toward it each frame so motion stays fluid between snapshots.
  const heroVisual = useRef<{ has: boolean; x: number; z: number; yaw: number }>({
    has: false,
    x: 0,
    z: 0,
    yaw: 0,
  });

  useEffect(() => {
    const u = units.current;
    const s = structs.current;
    const root = rootRef.current;
    return () => {
      if (root) {
        for (const g of u.values()) root.remove(g);
        for (const g of s.values()) root.remove(g);
      }
      u.clear();
      s.clear();
    };
  }, []);

  useFrame((_, dt) => {
    const root = rootRef.current;
    if (!root) return;
    const sample = runtime.sampleAt(INTERP_DELAY_MS);
    if (!sample) return;
    const { a, b, t } = sample;
    const cam = camera;

    // Identify my hero id (from the freshest snapshot we have).
    const latest = runtime.latest();
    const mySlot = runtime.slot;
    let myHeroId = -1;
    if (latest) {
      const me = latest.players.find((p) => p.slot === mySlot);
      myHeroId = me ? me.heroId : -1;
    }

    // --- local hero: smooth the rendered pose toward the shared-sim prediction ---
    // runtime.predict is produced by the deterministic Sim in connection.ts
    // (loadSnapshot + replay + step). Here we only ease the visual toward it.
    const hv = heroVisual.current;
    const p = runtime.predict;
    if (p.has) {
      if (!hv.has) {
        hv.has = true;
        hv.x = p.x;
        hv.z = p.z;
        hv.yaw = p.yaw;
      } else {
        const k = Math.min(1, dt * 16);
        hv.x += (p.x - hv.x) * k;
        hv.z += (p.z - hv.z) * k;
        let dy = p.yaw - hv.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        hv.yaw += dy * k;
      }
    } else {
      hv.has = false;
    }

    const aUnits = new Map<number, NetUnit>();
    for (const un of a.units) aUnits.set(un.id, un);

    // --- units ---
    const seen = new Set<number>();
    for (const un of b.units) {
      seen.add(un.id);
      let g = units.current.get(un.id);
      if (!g) {
        const cfg = UNIT_CFG[un.k];
        const mine = un.id === myHeroId;
        const color = TEAM_COLOR[un.t] ?? 0x999999;
        g = makeEntity(color, cfg, mine);
        units.current.set(un.id, g);
        root.add(g);
      }
      let x = un.x;
      let z = un.z;
      let yaw = un.y;
      if (un.id === myHeroId && hv.has) {
        x = hv.x;
        z = hv.z;
        yaw = hv.yaw;
      } else {
        const pa = aUnits.get(un.id);
        if (pa) {
          x = pa.x + (un.x - pa.x) * t;
          z = pa.z + (un.z - pa.z) * t;
        }
      }
      const cfg = UNIT_CFG[un.k];
      g.position.set(x, map.heightAt(x, z), z);
      g.rotation.y = yaw;
      setHp(g, un.hp / un.mhp, cam);
      void cfg;
    }
    for (const [id, g] of units.current) {
      if (!seen.has(id)) {
        root.remove(g);
        units.current.delete(id);
      }
    }

    // --- structures (no interpolation needed; they do not move) ---
    const seenS = new Set<number>();
    for (const st of b.structs as NetStruct[]) {
      seenS.add(st.id);
      let g = structs.current.get(st.id);
      if (!g) {
        const cfg = STRUCT_CFG[st.k];
        const color = TEAM_COLOR[st.t] ?? 0x999999;
        g = makeEntity(color, cfg, false);
        structs.current.set(st.id, g);
        g.position.set(st.x, map.heightAt(st.x, st.z), st.z);
        root.add(g);
      }
      setHp(g, st.hp / st.mhp, cam);
    }
    for (const [id, g] of structs.current) {
      if (!seenS.has(id)) {
        root.remove(g);
        structs.current.delete(id);
      }
    }
  });

  return <group ref={rootRef} />;
}
