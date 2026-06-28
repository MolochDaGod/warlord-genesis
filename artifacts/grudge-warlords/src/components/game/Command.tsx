import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { useCommand } from "../../game/command";
import { useGame } from "../../game/store";
import { SHOP_BUILDS } from "../../game/config";
import { structRadius } from "../../game/combat";

/** Friendly names shown in the "… RAISED" toast for each buildable structure. */
const BUILD_LABELS: Record<string, string> = {
  cannon: "CANNON TURRET",
  ballista: "BALLISTA TURRET",
  mage: "MAGE TOWER",
  barrier: "BARRIER",
};

interface Pickable {
  id: number;
  pos: THREE.Vector3;
  scale: number;
}

/** Selectable entities = the player's own commandable units. */
function pickables(): Pickable[] {
  const out: Pickable[] = [];
  for (const u of EM.units) {
    if (!u.alive || !u.commandable) continue;
    out.push({ id: u.id, pos: u.pos, scale: u.def.scale });
  }
  return out;
}

/**
 * Build legality: in bounds, on walkable terrain (not on a ridge), clear of
 * other structures, and out of the enemy base.
 */
function canPlace(x: number, z: number): boolean {
  const map = EM.map;
  const halfW = map.width / 2 - 1.5;
  const halfL = map.length / 2 - 1.5;
  if (Math.abs(x) > halfW || Math.abs(z) > halfL) return false;
  if (!map.grid.isWalkableWorld(x, z)) return false;
  if (Math.hypot(x - map.enemyCore.x, z - map.enemyCore.z) < 16) return false;
  for (const s of EM.structures) {
    if (!s.alive) continue;
    if (Math.hypot(x - s.pos.x, z - s.pos.z) < structRadius(s.kind) + 1.6) return false;
  }
  return true;
}

/**
 * RTS pointer + keyboard control (command mode). Left-click / drag selects your
 * units; right-click issues a smart move/attack; A/M/H/S issue explicit orders
 * at the cursor; B arms a cannon turret; Shift+1-5 assign control groups and 1-5
 * recall them. When a build is armed, the cursor shows a ghost and left-click
 * places it (with a collision/affordability check).
 */
export function CommandLayer() {
  const { camera, gl } = useThree();
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const ground = useRef(new THREE.Vector3(EM.map.rally.x, 0, EM.map.rally.z));
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _ray = useMemo(() => new THREE.Raycaster(), []);
  const _plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  // Ghost preview mesh.
  const ghost = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1.1, 1.3, 2, 10);
    const mat = new THREE.MeshBasicMaterial({ color: "#7ee37e", transparent: true, opacity: 0.4, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    return { mesh, geo, mat };
  }, []);

  useEffect(
    () => () => {
      ghost.geo.dispose();
      ghost.mat.dispose();
    },
    [ghost],
  );

  useEffect(() => {
    const el = gl.domElement;

    const toCanvas = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    };

    const groundAt = (e: PointerEvent): THREE.Vector3 | null => {
      const p = toCanvas(e);
      _ndc.set((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1, 0.5);
      _ray.setFromCamera(new THREE.Vector2(_ndc.x, _ndc.y), camera);
      const hit = new THREE.Vector3();
      if (_ray.ray.intersectPlane(_plane, hit)) return hit;
      return null;
    };

    const project = (pos: THREE.Vector3, w: number, h: number) => {
      _ndc.copy(pos);
      _ndc.y += 1;
      _ndc.project(camera);
      return { x: (_ndc.x * 0.5 + 0.5) * w, y: (-_ndc.y * 0.5 + 0.5) * h, behind: _ndc.z > 1 };
    };

    const onDown = (e: PointerEvent) => {
      if (useCommand.getState().mode !== "command") return;
      const cmd = useCommand.getState();

      // Right-click: smart order (attack-move if an enemy is near the cursor).
      if (e.button === 2) {
        const gpt = groundAt(e);
        if (gpt && cmd.selection.length) {
          let nearEnemy = false;
          for (const u of EM.units) {
            if (u.alive && u.faction === "enemy" && Math.hypot(u.pos.x - gpt.x, u.pos.z - gpt.z) < 4) {
              nearEnemy = true;
              break;
            }
          }
          cmd.issueOrder(nearEnemy ? "attackMove" : "move", gpt);
        }
        cmd.setBuild(null);
        ghost.mesh.visible = false;
        return;
      }
      if (e.button !== 0) return;

      // Build placement.
      if (cmd.build) {
        const gpt = groundAt(e);
        if (gpt) tryPlace(gpt.x, gpt.z);
        return;
      }

      // Begin marquee.
      const p = toCanvas(e);
      dragging.current = true;
      start.current = { x: p.x, y: p.y };
      cmd.setMarquee({ active: true, x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    };

    const onMove = (e: PointerEvent) => {
      const gpt = groundAt(e);
      if (gpt) ground.current.copy(gpt);
      if (!dragging.current) return;
      const p = toCanvas(e);
      useCommand
        .getState()
        .setMarquee({ active: true, x0: start.current.x, y0: start.current.y, x1: p.x, y1: p.y });
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging.current || e.button !== 0) return;
      dragging.current = false;
      const p = toCanvas(e);
      const cmd = useCommand.getState();
      cmd.clearMarquee();

      const dx = p.x - start.current.x;
      const dy = p.y - start.current.y;
      const list = pickables();
      const selected: number[] = [];

      if (Math.hypot(dx, dy) < 6) {
        let best: number | null = null;
        let bestD = 48;
        for (const it of list) {
          const s = project(it.pos, p.w, p.h);
          if (s.behind) continue;
          const d = Math.hypot(s.x - p.x, s.y - p.y);
          if (d < bestD) {
            bestD = d;
            best = it.id;
          }
        }
        if (best !== null) selected.push(best);
      } else {
        const minX = Math.min(start.current.x, p.x);
        const maxX = Math.max(start.current.x, p.x);
        const minY = Math.min(start.current.y, p.y);
        const maxY = Math.max(start.current.y, p.y);
        for (const it of list) {
          const s = project(it.pos, p.w, p.h);
          if (s.behind) continue;
          if (s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY) selected.push(it.id);
        }
      }
      cmd.setSelection(selected);
    };

    const tryPlace = (x: number, z: number) => {
      const cmd = useCommand.getState();
      const g = useGame.getState();
      const build = cmd.build;
      if (!build) return;
      if (!canPlace(x, z)) {
        g.pushMessage("CANNOT BUILD THERE", "warn");
        return;
      }
      if (g.credits < build.cost) {
        g.pushMessage("NOT ENOUGH CREDITS", "warn");
        return;
      }
      g.spendCredits(build.cost);
      const kind = build.ref as "cannon" | "ballista" | "mage" | "barrier";
      EM.addStructure("ally", kind, x, z);
      g.pushMessage(`${BUILD_LABELS[kind] ?? "STRUCTURE"} RAISED`, "good");
      EM.addImpact(new THREE.Vector3(x, EM.map.heightAt(x, z) + 0.5, z));
      cmd.setBuild(null);
    };

    const onContext = (e: Event) => {
      if (useCommand.getState().mode === "command") e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState();
      if (g.phase !== "battle") return;
      const cmd = useCommand.getState();
      if (cmd.mode !== "command") return;
      const gpt = ground.current;

      switch (e.code) {
        case "KeyA":
          cmd.issueOrder("attackMove", gpt);
          break;
        case "KeyM":
          cmd.issueOrder("move", gpt);
          break;
        case "KeyH":
          cmd.issueOrder("hold", gpt);
          break;
        case "KeyS":
          cmd.issueOrder("stop");
          break;
        case "KeyB": {
          const cannon = SHOP_BUILDS.find((b) => b.ref === "cannon");
          if (cannon) cmd.setBuild({ ref: "cannon", cost: cannon.cost });
          break;
        }
        case "Escape":
          cmd.setBuild(null);
          cmd.setSelection([]);
          break;
        default:
          if (e.code.startsWith("Digit")) {
            const n = parseInt(e.code.slice(5), 10) - 1;
            if (n >= 0 && n <= 4) {
              if (e.shiftKey) cmd.assignGroup(n);
              else cmd.recallGroup(n);
            }
          }
      }
    };

    const applyCursor = (mode: string) => {
      el.style.cursor = mode === "command" ? "crosshair" : "";
    };
    applyCursor(useCommand.getState().mode);
    const unsub = useCommand.subscribe((s) => applyCursor(s.mode));

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("contextmenu", onContext);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      unsub();
      el.style.cursor = "";
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("contextmenu", onContext);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [camera, gl, _ndc, _ray, _plane, ghost]);

  useFrame(() => {
    const build = useCommand.getState().build;
    if (!build || useCommand.getState().mode !== "command") {
      ghost.mesh.visible = false;
      return;
    }
    const gp = ground.current;
    const ok = canPlace(gp.x, gp.z) && useGame.getState().credits >= build.cost;
    ghost.mesh.visible = true;
    ghost.mesh.position.set(gp.x, EM.map.heightAt(gp.x, gp.z) + 1, gp.z);
    ghost.mat.color.set(ok ? "#7ee37e" : "#ff6b6b");
  });

  return <primitive object={ghost.mesh} />;
}

const RING_POOL = 64;

/** Animated ground highlight rings under every selected unit. */
export function SelectionRings() {
  const pool = useMemo(() => {
    const group = new THREE.Group();
    const geo = new THREE.RingGeometry(0.6, 0.8, 28);
    const mat = new THREE.MeshBasicMaterial({
      color: "#e0b252",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const rings = Array.from({ length: RING_POOL }, () => {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      group.add(m);
      return m;
    });
    return { group, geo, mat, rings };
  }, []);

  useEffect(() => {
    return () => {
      pool.geo.dispose();
      pool.mat.dispose();
    };
  }, [pool]);

  useFrame((state) => {
    const selection = useCommand.getState().selection;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.07;
    let i = 0;
    if (selection.length) {
      const byId = new Map<number, Pickable>();
      for (const it of pickables()) byId.set(it.id, it);
      for (const id of selection) {
        const it = byId.get(id);
        if (!it || i >= RING_POOL) continue;
        const ring = pool.rings[i++];
        ring.visible = true;
        ring.position.set(it.pos.x, 0.07, it.pos.z);
        ring.scale.setScalar(it.scale * 1.7 * pulse);
      }
    }
    for (; i < RING_POOL; i++) pool.rings[i].visible = false;
  });

  return <primitive object={pool.group} />;
}
