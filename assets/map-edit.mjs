/**
 * Standalone Map Edit runtime for warlord-genesis.vercel.app/edit
 * Terrain + towers/buildings scales + grid pathfinding + bottom/mid/top routes.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const KEY = "wg:map-edit:standalone:v1";
const COLORS = { bottom: 0xf59e0b, mid: 0x38bdf8, top: 0xe879f9 };

const MAPS = {
  standard: { label: "Standard", width: 240, length: 390 },
  large: { label: "Large", width: 600, length: 975 },
};

const DEFAULT = {
  mapSize: "standard",
  seed: 0x51c0de,
  mode: "grid",
  scales: { terrain: 1, towers: 1, buildings: 1, trees: 1, props: 1, routeLift: 0.4 },
  layers: { bottom: true, mid: true, top: true },
  showNav: true,
  showLanes: true,
};

function loadPrefs() {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}"), scales: { ...DEFAULT.scales, ...(JSON.parse(localStorage.getItem(KEY) || "{}").scales || {}) }, layers: { ...DEFAULT.layers, ...(JSON.parse(localStorage.getItem(KEY) || "{}").layers || {}) } };
  } catch {
    return structuredClone(DEFAULT);
  }
}
function savePrefs(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateBattlefield(seed, sizeKey) {
  const def = MAPS[sizeKey];
  const { width, length } = def;
  const halfW = width / 2, halfL = length / 2;
  const cols = Math.max(48, Math.round(width / 4));
  const rows = Math.max(64, Math.round(length / 4));
  const rnd = mulberry32(seed);
  const heights = new Float32Array(cols * rows);

  // Three lanes (west/center/east)
  const lanes = [
    { id: 0, name: "West", pts: [] },
    { id: 1, name: "Center", pts: [] },
    { id: 2, name: "East", pts: [] },
  ];
  const coreInset = length * 0.12;
  const allyCore = { x: 0, z: halfL - coreInset };
  const enemyCore = { x: 0, z: -halfL + coreInset };
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const z = halfL - coreInset - t * (length - 2 * coreInset);
    lanes[1].pts.push({ x: 0, z });
    lanes[0].pts.push({ x: -width * 0.28, z });
    lanes[2].pts.push({ x: width * 0.28, z });
  }

  const distLane = (x, z) => {
    let d = Infinity;
    for (const lane of lanes) {
      for (let i = 0; i < lane.pts.length - 1; i++) {
        const a = lane.pts[i], b = lane.pts[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len2 = dx * dx + dz * dz || 1;
        let u = ((x - a.x) * dx + (z - a.z) * dz) / len2;
        u = Math.max(0, Math.min(1, u));
        d = Math.min(d, Math.hypot(x - (a.x + dx * u), z - (a.z + dz * u)));
      }
    }
    d = Math.min(d, Math.hypot(x - allyCore.x, z - allyCore.z) - 18);
    d = Math.min(d, Math.hypot(x - enemyCore.x, z - enemyCore.z) - 18);
    return Math.max(0, d);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -halfW + (c / (cols - 1)) * width;
      const z = -halfL + (r / (rows - 1)) * length;
      const d = distLane(x, z);
      const ridge = smoothstep(Math.min(1, d / 14)) * (3.2 + rnd() * 1.4);
      const noise = (rnd() - 0.5) * 0.35;
      heights[r * cols + c] = Math.max(-0.2, ridge + noise);
    }
  }

  const heightAt = (x, z) => {
    const u = (x + halfW) / width;
    const v = (z + halfL) / length;
    const cf = Math.max(0, Math.min(cols - 1.001, u * (cols - 1)));
    const rf = Math.max(0, Math.min(rows - 1.001, v * (rows - 1)));
    const c0 = cf | 0, r0 = rf | 0;
    const c1 = Math.min(cols - 1, c0 + 1), r1 = Math.min(rows - 1, r0 + 1);
    const tx = cf - c0, ty = rf - r0;
    const h00 = heights[r0 * cols + c0], h10 = heights[r0 * cols + c1];
    const h01 = heights[r1 * cols + c0], h11 = heights[r1 * cols + c1];
    return h00 * (1 - tx) * (1 - ty) + h10 * tx * (1 - ty) + h01 * (1 - tx) * ty + h11 * tx * ty;
  };

  // walk grid
  const cell = 3.5;
  const gCols = Math.max(2, Math.round(width / cell));
  const gRows = Math.max(2, Math.round(length / cell));
  const originX = -halfW + cell / 2;
  const originZ = -halfL + cell / 2;
  const walkable = new Uint8Array(gCols * gRows);
  for (let r = 0; r < gRows; r++) {
    for (let c = 0; c < gCols; c++) {
      const x = originX + c * cell;
      const z = originZ + r * cell;
      walkable[r * gCols + c] = distLane(x, z) < 7 ? 1 : 0;
    }
  }

  const towers = [];
  const buildings = [];
  for (const fac of ["ally", "enemy"]) {
    const sign = fac === "ally" ? 1 : -1;
    for (let lane = 0; lane < 3; lane++) {
      const lx = (lane - 1) * width * 0.28;
      towers.push({ id: `tower_${fac}_${lane}_outer`, kind: "tower", x: lx, z: sign * length * 0.18, baseH: 9, baseW: 5.5, label: `${fac} outer L${lane}` });
      towers.push({ id: `tower_${fac}_${lane}_inner`, kind: "tower", x: lx * 0.55, z: sign * length * 0.32, baseH: 11, baseW: 6, label: `${fac} inner L${lane}` });
      buildings.push({ id: `bld_${fac}_barracks_${lane}`, kind: "building", x: lx - 10 * sign, z: sign * length * 0.36, baseH: 6.5, baseW: 8, label: `${fac} barracks L${lane}` });
    }
  }
  const structures = [
    { id: "ally_core", kind: "core", x: allyCore.x, z: allyCore.z, baseH: 14, baseW: 12, label: "Ally Citadel" },
    { id: "enemy_core", kind: "core", x: enemyCore.x, z: enemyCore.z, baseH: 14, baseW: 12, label: "Enemy Citadel" },
    ...towers,
    ...buildings,
  ];

  // trees
  const trees = [];
  for (let i = 0; i < 80; i++) {
    const x = (rnd() - 0.5) * width * 0.9;
    const z = (rnd() - 0.5) * length * 0.9;
    if (distLane(x, z) < 9) continue;
    trees.push({ x, z, scale: 0.8 + rnd() * 0.6, rot: rnd() * Math.PI * 2 });
  }

  return {
    width, length, cols, rows, heights, heightAt, lanes, structures, trees,
    grid: { cols: gCols, rows: gRows, cell, originX, originZ, walkable },
  };
}

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function findPath(grid, sx, sz, gx, gz) {
  const { cols, rows, cell, originX, originZ, walkable } = grid;
  const cellX = (x) => Math.max(0, Math.min(cols - 1, Math.round((x - originX) / cell)));
  const cellZ = (z) => Math.max(0, Math.min(rows - 1, Math.round((z - originZ) / cell)));
  const worldX = (c) => originX + c * cell;
  const worldZ = (r) => originZ + r * cell;
  const walk = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && walkable[r * cols + c] === 1;

  let sc = cellX(sx), sr = cellZ(sz), gc = cellX(gx), gr = cellZ(gz);
  if (!walk(sc, sr) || !walk(gc, gr)) return null;
  const start = sr * cols + sc, goal = gr * cols + gc;
  if (start === goal) return [{ x: gx, z: gz }];

  const n = cols * rows;
  const gScore = new Float32Array(n).fill(Infinity);
  const fScore = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const open = [start];
  gScore[start] = 0;
  fScore[start] = Math.hypot(gc - sc, gr - sr);
  const neigh = [[1,0],[ -1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  while (open.length) {
    open.sort((a, b) => fScore[a] - fScore[b]);
    const cur = open.shift();
    if (cur === goal) {
      const path = [];
      let c = cur;
      while (c !== -1) {
        path.push({ x: worldX(c % cols), z: worldZ((c / cols) | 0) });
        c = came[c];
      }
      path.reverse();
      return path;
    }
    const cc = cur % cols, cr = (cur / cols) | 0;
    for (const [dx, dz] of neigh) {
      const nc = cc + dx, nr = cr + dz;
      if (!walk(nc, nr)) continue;
      const ni = nr * cols + nc;
      const step = dx && dz ? 1.414 : 1;
      const tg = gScore[cur] + step;
      if (tg < gScore[ni]) {
        came[ni] = cur;
        gScore[ni] = tg;
        fScore[ni] = tg + Math.hypot(gc - nc, gr - nr);
        if (!open.includes(ni)) open.push(ni);
      }
    }
  }
  return null;
}

// ── Scene ────────────────────────────────────────────────────────────
const prefs = loadPrefs();
const canvas = document.getElementById("c");
const statusEl = document.getElementById("status");
const setStatus = (t) => { statusEl.textContent = t; };

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1020);
scene.fog = new THREE.Fog(0x0a1020, 200, 700);

const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 3000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;

scene.add(new THREE.AmbientLight(0x445566, 0.4));
scene.add(new THREE.HemisphereLight(0xb8d4ff, 0x3a2a18, 0.75));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
sun.position.set(100, 160, 70);
sun.castShadow = true;
scene.add(sun);

const root = new THREE.Group();
scene.add(root);
const routes = new THREE.Group();
scene.add(routes);

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(2500, 2500),
  new THREE.MeshStandardMaterial({ color: 0x0c3a6e, transparent: true, opacity: 0.75, roughness: 0.35 }),
);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.4;
scene.add(water);

let map = null;
let structureMeshes = new Map();

function clearGroup(g) {
  while (g.children.length) {
    const o = g.children.pop();
    o.traverse((x) => {
      if (x.geometry) x.geometry.dispose();
      if (x.material) {
        const m = Array.isArray(x.material) ? x.material : [x.material];
        m.forEach((mm) => mm.dispose());
      }
    });
  }
}

function rebuildMap() {
  clearGroup(root);
  clearGroup(routes);
  structureMeshes.clear();
  map = generateBattlefield(prefs.seed, prefs.mapSize);
  const s = prefs.scales;

  // terrain
  const { cols, rows, heights, width, length } = map;
  const halfW = width / 2, halfL = length / 2;
  const pos = new Float32Array(cols * rows * 3);
  const col = new Float32Array(cols * rows * 3);
  const low = new THREE.Color(0x2d4a28), high = new THREE.Color(0x6b8f4e), tmp = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = -halfW + (c / (cols - 1)) * width;
      const z = -halfL + (r / (rows - 1)) * length;
      const h = heights[i] * s.terrain;
      pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
      tmp.copy(low).lerp(high, Math.min(1, heights[i] / 3.5));
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = (r + 1) * cols + c, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  terrain.receiveShadow = true;
  root.add(terrain);

  // structures
  for (const st of map.structures) {
    const layer = st.kind === "tower" ? s.towers : s.buildings;
    const h = st.baseH * layer;
    const w = st.baseW * layer;
    const y0 = map.heightAt(st.x, st.z) * s.terrain;
    const g = new THREE.Group();
    g.position.set(st.x, y0, st.z);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * 0.88),
      new THREE.MeshStandardMaterial({ color: st.kind === "tower" ? 0x6b7280 : st.kind === "core" ? 0xa16207 : 0x8b7355, roughness: 0.85 }),
    );
    body.position.y = h / 2;
    body.castShadow = true;
    g.add(body);
    for (const [lvl, t] of [["bottom", 0.04], ["mid", 0.5], ["top", 1]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), new THREE.MeshBasicMaterial({ color: COLORS[lvl] }));
      m.position.y = h * t;
      g.add(m);
    }
    root.add(g);
    structureMeshes.set(st.id, { st, h, y0 });
  }

  // trees
  for (const t of map.trees) {
    const y = map.heightAt(t.x, t.z) * s.terrain;
    const g = new THREE.Group();
    g.position.set(t.x, y, t.z);
    g.rotation.y = t.rot;
    g.scale.setScalar(t.scale * s.trees);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x5c4033 }));
    trunk.position.y = 1.2;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 7), new THREE.MeshStandardMaterial({ color: 0x1f6b34 }));
    crown.position.y = 3.4;
    g.add(trunk, crown);
    root.add(g);
  }

  // lanes
  if (prefs.showLanes) {
    for (const lane of map.lanes) {
      const pts = lane.pts.map((p) => new THREE.Vector3(p.x, map.heightAt(p.x, p.z) * s.terrain + 0.25, p.z));
      root.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 }),
      ));
    }
  }

  // nav samples
  if (prefs.showNav) {
    const pts = [];
    const g = map.grid;
    for (let r = 0; r < g.rows; r += 2) {
      for (let c = 0; c < g.cols; c += 2) {
        if (!g.walkable[r * g.cols + c]) continue;
        const x = g.originX + c * g.cell;
        const z = g.originZ + r * g.cell;
        pts.push(x, map.heightAt(x, z) * s.terrain + 0.15, z);
      }
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    root.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x22c55e, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.55 })));
  }

  const d = Math.max(width, length) * 0.55;
  camera.position.set(d * 0.55, d * 0.45, d * 0.7);
  controls.target.set(0, 2, 0);
  controls.update();

  fillSelects();
  setStatus(`Map ${prefs.mapSize} · seed ${prefs.seed.toString(16)} · structures=${map.structures.length}`);
  savePrefs(prefs);
}

function fillSelects() {
  const from = document.getElementById("from");
  const to = document.getElementById("to");
  const curFrom = from.value, curTo = to.value;
  from.innerHTML = "";
  to.innerHTML = "";
  for (const st of map.structures) {
    from.add(new Option(st.label, st.id));
    to.add(new Option(st.label, st.id));
  }
  if ([...from.options].some((o) => o.value === curFrom)) from.value = curFrom;
  else from.value = "ally_core";
  if ([...to.options].some((o) => o.value === curTo)) to.value = curTo;
  else to.value = "enemy_core";
}

function drawRoutes() {
  clearGroup(routes);
  if (!map) return;
  const fromId = document.getElementById("from").value;
  const toId = document.getElementById("to").value;
  const from = map.structures.find((s) => s.id === fromId);
  const to = map.structures.find((s) => s.id === toId);
  if (!from || !to || fromId === toId) return;
  const s = prefs.scales;
  let xz = null;
  if (prefs.mode === "grid") {
    const path = findPath(map.grid, from.x, from.z, to.x, to.z);
    xz = path ? [{ x: from.x, z: from.z }, ...path] : null;
  }
  if (!xz) {
    xz = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      xz.push({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
    }
  }
  const levels = ["bottom", "mid", "top"].filter((l) => prefs.layers[l]);
  for (const level of levels) {
    const lt = level === "bottom" ? 0.04 : level === "mid" ? 0.5 : 1;
    const fromScale = from.kind === "tower" ? s.towers : s.buildings;
    const toScale = to.kind === "tower" ? s.towers : s.buildings;
    const gFrom = map.heightAt(from.x, from.z) * s.terrain;
    const gTo = map.heightAt(to.x, to.z) * s.terrain;
    const fromA = new THREE.Vector3(from.x, gFrom + from.baseH * fromScale * lt, from.z);
    const toA = new THREE.Vector3(to.x, gTo + to.baseH * toScale * lt, to.z);
    const ground = xz.map((p) => new THREE.Vector3(p.x, map.heightAt(p.x, p.z) * s.terrain + s.routeLift, p.z));
    const full = [fromA, ground[0], ...ground.slice(1, -1), ground[ground.length - 1], toA];
    routes.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(full),
      new THREE.LineBasicMaterial({ color: COLORS[level], transparent: true, opacity: 0.95 }),
    ));
    for (const p of [fromA, toA]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12), new THREE.MeshBasicMaterial({ color: COLORS[level] }));
      ball.position.copy(p);
      routes.add(ball);
    }
  }
  setStatus(`Routes drawn · ${levels.join("+")} · mode=${prefs.mode}`);
  savePrefs(prefs);
}

// UI wiring
const SCALE_META = [
  ["terrain", "Terrain height", 0.25, 3],
  ["towers", "Towers mesh", 0.15, 4],
  ["buildings", "Buildings", 0.15, 4],
  ["trees", "Trees", 0.15, 4],
  ["props", "Props", 0.15, 4],
  ["routeLift", "Route lift (m)", 0, 2.5],
];
const scalesEl = document.getElementById("scales");
for (const [key, label, min, max] of SCALE_META) {
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "10px";
  wrap.innerHTML = `<div class="row"><span>${label}</span><span class="v" id="v-${key}">${prefs.scales[key].toFixed(2)}×</span></div>`;
  const input = document.createElement("input");
  input.type = "range"; input.min = min; input.max = max; input.step = 0.05;
  input.value = prefs.scales[key];
  input.addEventListener("input", () => {
    prefs.scales[key] = Number(input.value);
    document.getElementById(`v-${key}`).textContent = `${prefs.scales[key].toFixed(2)}×`;
    rebuildMap();
  });
  wrap.appendChild(input);
  scalesEl.appendChild(wrap);
}

document.getElementById("mapSize").value = prefs.mapSize;
document.getElementById("seed").value = prefs.seed.toString(16);
document.getElementById("mapSize").onchange = (e) => { prefs.mapSize = e.target.value; rebuildMap(); };
document.getElementById("seed").onchange = (e) => {
  const n = parseInt(e.target.value, 16);
  if (!Number.isNaN(n)) { prefs.seed = n >>> 0; rebuildMap(); }
};
document.getElementById("randSeed").onclick = () => {
  prefs.seed = (Math.random() * 0xffffffff) >>> 0;
  document.getElementById("seed").value = prefs.seed.toString(16);
  rebuildMap();
};
document.getElementById("showNav").checked = prefs.showNav;
document.getElementById("showLanes").checked = prefs.showLanes;
document.getElementById("showNav").onchange = (e) => { prefs.showNav = e.target.checked; rebuildMap(); };
document.getElementById("showLanes").onchange = (e) => { prefs.showLanes = e.target.checked; rebuildMap(); };

document.querySelectorAll("button.mode").forEach((btn) => {
  btn.classList.toggle("on", btn.dataset.mode === prefs.mode);
  btn.onclick = () => {
    prefs.mode = btn.dataset.mode;
    document.querySelectorAll("button.mode").forEach((b) => b.classList.toggle("on", b.dataset.mode === prefs.mode));
    savePrefs(prefs);
  };
});
document.querySelectorAll("button.layer[data-layer]").forEach((btn) => {
  const lvl = btn.dataset.layer;
  btn.className = `layer ${prefs.layers[lvl] ? `on-${lvl}` : ""}`;
  btn.onclick = () => {
    prefs.layers[lvl] = !prefs.layers[lvl];
    btn.className = `layer ${prefs.layers[lvl] ? `on-${lvl}` : ""}`;
    savePrefs(prefs);
  };
});
document.getElementById("draw").onclick = drawRoutes;

function resize() {
  const view = document.getElementById("view");
  const w = view.clientWidth, h = view.clientHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", resize);
resize();
rebuildMap();

(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
})();
