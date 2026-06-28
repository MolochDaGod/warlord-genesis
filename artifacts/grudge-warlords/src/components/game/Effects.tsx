import { useRef, useState, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { updateMeleeFx } from "../../game/combat";

const _seg = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _UP = new THREE.Vector3(0, 1, 0);
const _FWD = new THREE.Vector3(0, 0, 1);
const _fire = new THREE.Vector3();
const _fireCol = new THREE.Color();
const _emberRed = new THREE.Color("#7a1500");

/** Soft radial glow sprite texture, shared by all additive VFX. */
function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.65)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Cache one outlined-text texture per distinct (text + color) combat number. */
const _textCache = new Map<string, THREE.CanvasTexture>();
function getTextTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${color}|${text}`;
  const cached = _textCache.get(key);
  if (cached) return cached;
  const fontSize = 52;
  const pad = 14;
  const measure = document.createElement("canvas").getContext("2d")!;
  const font = `900 ${fontSize}px "Cinzel Decorative", serif`;
  measure.font = font;
  const w = Math.ceil(measure.measureText(text).width) + pad * 2;
  const h = fontSize + pad * 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.aspect = w / h;
  // Evict the oldest texture once the cache is large to bound GPU memory in
  // marathon matches (distinct damage values x colors are otherwise unbounded).
  if (_textCache.size >= 200) {
    const oldest = _textCache.keys().next().value;
    if (oldest !== undefined) {
      _textCache.get(oldest)?.dispose();
      _textCache.delete(oldest);
    }
  }
  _textCache.set(key, tex);
  return tex;
}

/**
 * Floating combat numbers (damage / heal). Rise, drift and fade out, drawn as
 * camera-facing sprites with cached outlined-text textures. Driven imperatively
 * from EM.floats through a pre-allocated sprite pool (mirrors the other VFX
 * pools) and runs regardless of phase so spawned numbers always finish.
 */
function FloatingNumbers() {
  const pool = useMemo(() => {
    const group = new THREE.Group();
    const sprites = Array.from({ length: 32 }, () => {
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }),
      );
      spr.renderOrder = 999;
      spr.visible = false;
      group.add(spr);
      return spr;
    });
    return { group, sprites };
  }, []);

  useEffect(() => {
    return () => {
      for (const spr of pool.sprites) spr.material.dispose();
      for (const tex of _textCache.values()) tex.dispose();
      _textCache.clear();
    };
  }, [pool]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    for (let i = EM.floats.length - 1; i >= 0; i--) {
      const f = EM.floats[i];
      f.life -= dt;
      f.pos.addScaledVector(f.vel, dt);
      f.vel.multiplyScalar(1 - dt * 1.6);
      if (f.life <= 0) EM.floats.splice(i, 1);
    }
    for (let i = 0; i < pool.sprites.length; i++) {
      const spr = pool.sprites[i];
      const f = EM.floats[i];
      if (!f) {
        spr.visible = false;
        continue;
      }
      const k = Math.max(0, f.life / f.maxLife);
      const tex = getTextTexture(f.text, f.color);
      if (spr.userData.key !== `${f.color}|${f.text}`) {
        spr.userData.key = `${f.color}|${f.text}`;
        spr.material.map = tex;
        spr.material.needsUpdate = true;
      }
      const aspect = (tex.userData.aspect as number) ?? 3;
      const pop = 1 + (1 - k) * 0.25;
      const base = f.scale * 0.95 * pop;
      spr.visible = true;
      spr.position.copy(f.pos);
      spr.scale.set(base * aspect, base, 1);
      spr.material.opacity = Math.min(1, k / 0.35);
    }
  });

  return <primitive object={pool.group} />;
}

/**
 * Hero attack VFX: muzzle flashes, travelling fire-bolt trails, smoke puffs and
 * ember sparks. Rendered through PRE-ALLOCATED object pools driven imperatively
 * each frame from the EM particle arrays, so sustained automatic fire never
 * triggers React reconciliation (the rest of Effects uses id-diff re-renders,
 * but particle churn here is far too high for that).
 */
function HeroVfx() {
  const glow = useMemo(() => makeGlowTexture(), []);

  const pool = useMemo(() => {
    const group = new THREE.Group();

    const flashMat = new THREE.SpriteMaterial({
      map: glow,
      color: "#ffd27f",
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const emberMat = new THREE.SpriteMaterial({
      map: glow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const smokeMat = new THREE.SpriteMaterial({
      map: glow,
      color: "#6b6b6b",
      depthWrite: false,
      transparent: true,
      opacity: 0.4,
    });
    const fireMat = new THREE.SpriteMaterial({
      map: glow,
      color: "#ff7a1a",
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const boltMat = new THREE.MeshBasicMaterial({
      color: "#ffb24d",
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const boltGeo = new THREE.CylinderGeometry(0.05, 0.02, 1, 6);
    const slashMat = new THREE.MeshBasicMaterial({
      color: "#cfeaff",
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const shockMat = new THREE.MeshBasicMaterial({
      color: "#ffd0a6",
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const slashGeo = new THREE.RingGeometry(0.55, 1, 24, 1, Math.PI * 0.16, Math.PI * 0.68);
    const shockGeo = new THREE.RingGeometry(0.86, 1, 48);

    const make = (n: number, factory: () => THREE.Object3D) =>
      Array.from({ length: n }, () => {
        const o = factory();
        o.visible = false;
        group.add(o);
        return o;
      });

    const flashes = make(10, () => new THREE.Sprite(flashMat.clone())) as THREE.Sprite[];
    const embers = make(80, () => new THREE.Sprite(emberMat.clone())) as THREE.Sprite[];
    const smoke = make(48, () => new THREE.Sprite(smokeMat.clone())) as THREE.Sprite[];
    const fires = make(140, () => new THREE.Sprite(fireMat.clone())) as THREE.Sprite[];
    const bolts = make(24, () => new THREE.Mesh(boltGeo, boltMat.clone())) as THREE.Mesh[];
    const slashes = make(16, () => new THREE.Mesh(slashGeo, slashMat.clone())) as THREE.Mesh[];
    const shocks = make(16, () => new THREE.Mesh(shockGeo, shockMat.clone())) as THREE.Mesh[];

    return {
      group,
      flashes,
      embers,
      smoke,
      fires,
      bolts,
      slashes,
      shocks,
      mats: [flashMat, emberMat, smokeMat, fireMat, boltMat, slashMat, shockMat],
      geos: [boltGeo, slashGeo, shockGeo],
    };
  }, [glow]);

  useEffect(() => {
    return () => {
      glow.dispose();
      for (const geo of pool.geos) geo.dispose();
      for (const m of pool.mats) m.dispose();
      const free = (o: THREE.Object3D) => {
        const mat = (o as THREE.Mesh | THREE.Sprite).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      };
      pool.flashes.forEach(free);
      pool.embers.forEach(free);
      pool.smoke.forEach(free);
      pool.fires.forEach(free);
      pool.bolts.forEach(free);
      pool.slashes.forEach(free);
      pool.shocks.forEach(free);
    };
  }, [glow, pool]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);

    updateMeleeFx(dt);

    // Muzzle flashes.
    for (let i = EM.muzzleFlashes.length - 1; i >= 0; i--) {
      const f = EM.muzzleFlashes[i];
      f.life -= dt;
      if (f.life <= 0) EM.muzzleFlashes.splice(i, 1);
    }
    for (let i = 0; i < pool.flashes.length; i++) {
      const spr = pool.flashes[i];
      const f = EM.muzzleFlashes[i];
      if (!f) {
        spr.visible = false;
        continue;
      }
      const k = Math.max(0, f.life / f.maxLife);
      spr.visible = true;
      spr.position.copy(f.pos);
      spr.scale.setScalar(f.size * (0.7 + k * 0.6));
      spr.material.rotation = f.rot;
      spr.material.opacity = k;
    }

    // Fire bolts (travelling trails).
    for (let i = EM.bolts.length - 1; i >= 0; i--) {
      const b = EM.bolts[i];
      b.traveled += b.speed * dt;
      if (b.traveled >= b.dist) {
        EM.addImpact(b.to);
        EM.bolts.splice(i, 1);
        continue;
      }
      b.pos.copy(b.from).addScaledVector(b.dir, b.traveled);
    }
    for (let i = 0; i < pool.bolts.length; i++) {
      const mesh = pool.bolts[i];
      const b = EM.bolts[i];
      if (!b) {
        mesh.visible = false;
        continue;
      }
      const trail = Math.min(2.2, b.traveled);
      mesh.visible = true;
      _seg.copy(b.dir);
      _q.setFromUnitVectors(_UP, _seg);
      mesh.quaternion.copy(_q);
      mesh.position.copy(b.pos).addScaledVector(b.dir, -trail / 2);
      mesh.scale.set(1, trail, 1);
    }

    // Smoke puffs.
    for (let i = EM.smoke.length - 1; i >= 0; i--) {
      const s = EM.smoke[i];
      s.life -= dt;
      s.pos.addScaledVector(s.vel, dt);
      s.vel.multiplyScalar(1 - dt * 1.2);
      if (s.life <= 0) EM.smoke.splice(i, 1);
    }
    for (let i = 0; i < pool.smoke.length; i++) {
      const spr = pool.smoke[i];
      const s = EM.smoke[i];
      if (!s) {
        spr.visible = false;
        continue;
      }
      const k = Math.max(0, s.life / s.maxLife);
      spr.visible = true;
      spr.position.copy(s.pos);
      spr.scale.setScalar(s.size * (1.4 - k));
      spr.material.opacity = k * 0.4;
    }

    // Burning structures: any building below a third HP belches flame from its
    // crown. Emission is rate-limited via dt so it stays frame-independent.
    for (const s of EM.structures) {
      if (!s.alive || s.hp / s.maxHp >= 0.35) continue;
      const rate = s.kind === "core" ? 26 : s.kind === "tower" ? 16 : 8;
      if (Math.random() < dt * rate) {
        const crown = s.kind === "core" ? 3.6 : s.kind === "tower" ? 3.0 : 1.2;
        const spread = s.kind === "core" ? 2.0 : s.kind === "tower" ? 1.4 : 0.8;
        _fire.set(
          s.pos.x + (Math.random() - 0.5) * spread,
          s.pos.y + crown + Math.random() * 0.8,
          s.pos.z + (Math.random() - 0.5) * spread,
        );
        EM.addFire(_fire, "#ff7a1a", s.kind === "core" ? 0.95 : 0.7);
      }
    }

    // Fire puffs (impact bursts + structure burns): rise, drift, redden, fade.
    for (let i = EM.fires.length - 1; i >= 0; i--) {
      const f = EM.fires[i];
      f.life -= dt;
      f.vel.y -= 1.1 * dt;
      f.pos.addScaledVector(f.vel, dt);
      f.vel.multiplyScalar(1 - dt * 1.4);
      if (f.life <= 0) EM.fires.splice(i, 1);
    }
    for (let i = 0; i < pool.fires.length; i++) {
      const spr = pool.fires[i];
      const f = EM.fires[i];
      if (!f) {
        spr.visible = false;
        continue;
      }
      const k = Math.max(0, f.life / f.maxLife);
      spr.visible = true;
      spr.position.copy(f.pos);
      spr.scale.setScalar(f.size * (0.5 + (1 - k) * 0.7));
      _fireCol.set(f.color).lerp(_emberRed, 1 - k);
      spr.material.color.copy(_fireCol);
      spr.material.opacity = Math.min(1, k * 1.6);
    }

    // Ember sparks.
    for (let i = EM.embers.length - 1; i >= 0; i--) {
      const e = EM.embers[i];
      e.life -= dt;
      e.vel.y -= 9 * dt;
      e.pos.addScaledVector(e.vel, dt);
      if (e.life <= 0) EM.embers.splice(i, 1);
    }
    for (let i = 0; i < pool.embers.length; i++) {
      const spr = pool.embers[i];
      const e = EM.embers[i];
      if (!e) {
        spr.visible = false;
        continue;
      }
      const k = Math.max(0, e.life / e.maxLife);
      spr.visible = true;
      spr.position.copy(e.pos);
      spr.scale.setScalar(0.12 + k * 0.16);
      spr.material.color.set(e.color);
      spr.material.opacity = k;
    }

    // Slash waves (travelling crescents).
    for (let i = 0; i < pool.slashes.length; i++) {
      const mesh = pool.slashes[i];
      const s = EM.slashes[i];
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (!s) {
        mesh.visible = false;
        continue;
      }
      const k = Math.max(0, 1 - s.traveled / s.range);
      mesh.visible = true;
      mesh.position.copy(s.pos);
      _seg.copy(s.dir);
      _q.setFromUnitVectors(_FWD, _seg);
      mesh.quaternion.copy(_q);
      mesh.scale.setScalar(s.width * 1.15);
      mat.color.set(s.color);
      mat.opacity = 0.5 + 0.5 * k;
    }

    // Shockwave rings (expanding ground discs).
    for (let i = 0; i < pool.shocks.length; i++) {
      const mesh = pool.shocks[i];
      const w = EM.shocks[i];
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (!w) {
        mesh.visible = false;
        continue;
      }
      const life = Math.max(0, w.life / w.maxLife);
      mesh.visible = true;
      mesh.position.set(w.pos.x, 0.12, w.pos.z);
      mesh.rotation.set(-Math.PI / 2, 0, 0);
      mesh.scale.setScalar(Math.max(0.001, w.radius));
      mat.color.set(w.color);
      mat.opacity = life * 0.7;
    }
  });

  return <primitive object={pool.group} />;
}

function Tracers() {
  const groupRef = useRef<THREE.Group>(null);
  const [, force] = useState(0);
  const ver = useRef("");

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    for (let i = EM.tracers.length - 1; i >= 0; i--) {
      EM.tracers[i].life -= dt;
      if (EM.tracers[i].life <= 0) EM.tracers.splice(i, 1);
    }
    const v = EM.tracers.map((t) => t.id).join(",");
    if (v !== ver.current) {
      ver.current = v;
      force((n) => n + 1);
    }
  });

  return (
    <group ref={groupRef}>
      {EM.tracers.map((t) => {
        _seg.copy(t.to).sub(t.from);
        const len = _seg.length();
        const mid = t.from.clone().addScaledVector(_seg, 0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          _seg.clone().normalize(),
        );
        return (
          <mesh key={t.id} position={mid.toArray()} quaternion={quat}>
            <cylinderGeometry args={[0.025, 0.025, len, 5]} />
            <meshBasicMaterial color={t.color} transparent opacity={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

function Sparks() {
  const [, force] = useState(0);
  const ver = useRef("");
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    for (let i = EM.sparks.length - 1; i >= 0; i--) {
      EM.sparks[i].life -= dt;
      if (EM.sparks[i].life <= 0) EM.sparks.splice(i, 1);
    }
    const v = EM.sparks.map((s) => s.id).join(",");
    if (v !== ver.current) {
      ver.current = v;
      force((n) => n + 1);
    }
  });
  return (
    <group>
      {EM.sparks.map((s) => (
        <mesh key={s.id} position={s.pos.toArray()} scale={(0.35 - s.life) * 3 + 0.3}>
          <icosahedronGeometry args={[0.25, 0]} />
          <meshBasicMaterial color={s.color} transparent opacity={Math.max(0, s.life * 3)} />
        </mesh>
      ))}
    </group>
  );
}

export function Effects() {
  return (
    <>
      <Tracers />
      <Sparks />
      <HeroVfx />
      <FloatingNumbers />
    </>
  );
}
