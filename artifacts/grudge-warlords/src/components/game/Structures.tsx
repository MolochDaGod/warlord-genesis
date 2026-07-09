import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EM, type StructureEntity } from "../../game/entities";
import { PROJECTILES, STRUCT_PROJECTILE } from "../../game/config";
import { useGame } from "../../game/store";
import { dealDamage, distXZ, findStructureTarget } from "../../game/combat";
import { playerGrudgeFaction, enemyGrudgeFaction } from "../../engine/grudge6";
import { towerPackForFactionTier, type TowerPack, type TowerTier } from "../../engine/towerAssets";
import { bootEngine, getEngine } from "../../engine/boot";
import { TowerModel, preloadTowers } from "./TowerModel";

preloadTowers(getEngine().cdnReachable);
bootEngine().then((s) => preloadTowers(s.cdnReachable));

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

const FACTION_ACCENT: Record<string, string> = { ally: "#e0b252", enemy: "#c0392b" };

function towerPackForSide(faction: string, tier: TowerTier): TowerPack {
  const id = faction === "ally" ? playerGrudgeFaction() : enemyGrudgeFaction();
  return towerPackForFactionTier(id, tier);
}

/** Muzzle flash tint + size per turret archetype so shots read at a glance. */
const TURRET_MUZZLE: Partial<Record<StructureEntity["kind"], { color: string; size: number }>> = {
  cannon: { color: "#ffc080", size: 0.85 },
  ballista: { color: "#ffe8b0", size: 0.65 },
  mage: { color: "#c9a3ff", size: 0.75 },
  tower: { color: "#ffb070", size: 0.7 },
  core: { color: "#ff7b3a", size: 1.1 },
};

function StructureMesh({ kind, faction }: { kind: StructureEntity["kind"]; faction: string }) {
  const accent = FACTION_ACCENT[faction];
  const mats = useMemo(() => {
    const stone = new THREE.MeshStandardMaterial({ color: faction === "ally" ? "#5a4636" : "#4a2e28", roughness: 0.9 });
    const trim = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.4,
    });
    const dark = new THREE.MeshStandardMaterial({ color: "#241712", roughness: 0.8 });
    return { stone, trim, dark };
  }, [faction, accent]);

  const { stone, trim, dark } = mats;

  if (kind === "core") {
    return (
      <group>
        <mesh material={stone} position={[0, 1.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[3.2, 3.8, 2.4, 8]} />
        </mesh>
        <mesh material={dark} position={[0, 3, 0]} castShadow>
          <cylinderGeometry args={[2, 2.4, 1.6, 8]} />
        </mesh>
        <mesh material={trim} position={[0, 4.6, 0]}>
          <icosahedronGeometry args={[1.3, 0]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            material={stone}
            position={[Math.cos((i / 4) * Math.PI * 2) * 3.4, 2.6, Math.sin((i / 4) * Math.PI * 2) * 3.4]}
            castShadow
          >
            <boxGeometry args={[0.7, 3.2, 0.7]} />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === "cannon") {
    return (
      <group>
        <mesh material={dark} position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.8, 1, 0.8, 8]} />
        </mesh>
        <mesh material={stone} position={[0, 1, 0]} castShadow>
          <boxGeometry args={[1, 0.8, 1]} />
        </mesh>
        {/* Stout wide barrel reading as a heavy cannon. */}
        <mesh material={dark} position={[0, 1.35, 0.6]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.32, 1.2, 10]} />
        </mesh>
        <mesh material={trim} position={[0, 1.35, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.06, 8, 12]} />
        </mesh>
      </group>
    );
  }
  if (kind === "ballista") {
    return (
      <group>
        <mesh material={dark} position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.9, 0.8, 8]} />
        </mesh>
        <mesh material={stone} position={[0, 1, 0]} castShadow>
          <boxGeometry args={[0.9, 0.6, 0.9]} />
        </mesh>
        {/* Long thin bolt and a crossbow bow to read as a ballista. */}
        <mesh material={trim} position={[0, 1.3, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.4, 6]} />
        </mesh>
        <mesh material={dark} position={[0, 1.3, 0.2]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 1.5, 6]} />
        </mesh>
      </group>
    );
  }
  if (kind === "mage") {
    return (
      <group>
        <mesh material={stone} position={[0, 1.4, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.6, 0.95, 2.8, 6]} />
        </mesh>
        <mesh material={dark} position={[0, 2.95, 0]} castShadow>
          <cylinderGeometry args={[0.85, 0.7, 0.5, 6]} />
        </mesh>
        {/* Floating glowing arcane orb. */}
        <mesh material={trim} position={[0, 3.55, 0]}>
          <icosahedronGeometry args={[0.55, 1]} />
        </mesh>
      </group>
    );
  }
  // barrier
  return (
    <group>
      <mesh material={stone} position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.4, 0.8]} />
      </mesh>
      <mesh material={dark} position={[0, 1.5, 0]}>
        <boxGeometry args={[2.4, 0.3, 1]} />
      </mesh>
      {[-0.8, 0, 0.8].map((x) => (
        <mesh key={x} material={trim} position={[x, 1.75, 0]}>
          <coneGeometry args={[0.18, 0.4, 4]} />
        </mesh>
      ))}
    </group>
  );
}

export function Structures() {
  const { camera } = useThree();
  const refs = useMemo(() => new Map<number, THREE.Group>(), []);
  const [, force] = useState(0);
  const version = useRef("");

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const g = useGame.getState();
    if (g.phase !== "battle") return;
    const heroAlive = !g.heroDead;

    for (const s of EM.structures) {
      if (!s.alive) continue;
      s.fireTimer -= dt;
      s.muzzleFlash = Math.max(0, s.muzzleFlash - dt);
      s.hitFlash = Math.max(0, s.hitFlash - dt);
      s.underAttack = Math.max(0, s.underAttack - dt);
      if (s.kind === "barrier" || s.range <= 0) continue;

      const target = findStructureTarget(s.faction, s.pos.x, s.pos.z, s.range);
      let aimX: number | null = null;
      let aimZ: number | null = null;
      let fireHero = false;

      // Enemy buildings will also shoot the hero if he is the closest threat.
      if (s.faction === "enemy" && heroAlive) {
        const hd = distXZ(s.pos, EM.playerPos.x, EM.playerPos.z);
        const td = target ? distXZ(s.pos, target.pos.x, target.pos.z) : Infinity;
        if (hd <= s.range && hd < td) {
          fireHero = true;
          aimX = EM.playerPos.x;
          aimZ = EM.playerPos.z;
        }
      }
      if (!fireHero && target) {
        aimX = target.pos.x;
        aimZ = target.pos.z;
      }

      if (aimX !== null && aimZ !== null) {
        s.yaw = Math.atan2(aimX - s.pos.x, aimZ - s.pos.z);
        if (s.fireTimer <= 0) {
          s.fireTimer = s.fireRate;
          s.muzzleFlash = 0.12;
          _from.copy(s.pos).setY(
            s.kind === "core" ? 4.4 : s.kind === "tower" ? 4 : s.kind === "mage" ? 3.2 : 1.3,
          );
          _to.set(aimX, fireHero ? 1.2 : target ? 1 : 1, aimZ);
          const muzzle = TURRET_MUZZLE[s.kind];
          EM.addMuzzleFlash(_from, muzzle);
          if (s.kind === "mage") EM.addEmber(_from.clone(), "#c9a3ff");
          else if (s.kind === "cannon" || s.kind === "core") EM.addEmber(_from.clone(), "#ffc080");
          const shell = STRUCT_PROJECTILE[s.kind];
          // Army-wide buffs (relic + ally tech) scale a structure's outgoing dmg.
          const dmg = s.damage * EM.factionDmgMult(s.faction);
          // Heavy shells (cannon / fire / wizard) deal their damage as AoE at
          // impact; light shells stay single-target hitscan dealt now.
          const splashShell = shell ? !!PROJECTILES[shell].splash : false;
          if (shell) {
            EM.addProjectile(
              shell,
              _from,
              _to,
              splashShell ? { faction: s.faction, splashDamage: dmg } : {},
            );
          } else {
            EM.addTracer(_from, _to, s.faction === "ally" ? "#e0b252" : "#ff6b6b");
          }
          EM.addSpark(_to, "#ffd27f");
          if (fireHero) {
            g.damagePlayer(dmg);
          } else if (target && !splashShell) {
            dealDamage(target, dmg);
          }
        }
      }
    }

    // Mirror core HP + resolve win / lose.
    if (EM.allyCore && EM.enemyCore) {
      g.setCoreHp(EM.allyCore.hp, EM.enemyCore.hp);
      if (EM.enemyCore.hp <= 0) g.win();
      else if (EM.allyCore.hp <= 0) g.lose();
    }

    // Turret rotation + overhead HP bars (cores use the HUD frames instead).
    for (const s of EM.structures) {
      const grp = refs.get(s.id);
      if (!grp) continue;
      if (s.kind === "cannon" || s.kind === "ballista" || s.kind === "mage") grp.rotation.y = s.yaw;
      if (s.kind === "core") continue;
      const ud = grp.userData as { hpbar?: THREE.Object3D; hpfill?: THREE.Object3D };
      if (ud.hpbar === undefined) {
        ud.hpbar = grp.getObjectByName("hpbar") ?? undefined;
        ud.hpfill = grp.getObjectByName("hpfill") ?? undefined;
      }
      if (ud.hpbar) {
        ud.hpbar.quaternion.copy(grp.quaternion).invert().multiply(camera.quaternion);
      }
      if (ud.hpfill) {
        const frac = Math.max(0.001, s.hp / s.maxHp);
        ud.hpfill.scale.x = frac;
        ud.hpfill.position.x = -(1 - frac) * 0.9;
      }
    }

    let key = "";
    for (const s of EM.structures) if (s.alive) key += s.id + ",";
    if (key !== version.current) {
      version.current = key;
      force((n) => n + 1);
    }
  });

  const setRef = (id: number) => (el: THREE.Group | null) => {
    if (el) refs.set(id, el);
    else refs.delete(id);
  };

  return (
    <>
      {EM.structures
        .filter((s) => s.alive)
        .map((s) => {
          const barY =
            s.kind === "tower" ? 7.8 : s.kind === "mage" ? 4.4 : s.kind === "barrier" ? 2.4 : 2.1;
          const barColor = s.faction === "ally" ? "#7ee37e" : "#ff6b6b";
          return (
            <group key={s.id} ref={setRef(s.id)} position={[s.pos.x, s.pos.y, s.pos.z]} rotation={[0, s.yaw, 0]}>
              {s.kind === "tower" ? (
                <TowerModel
                  pack={towerPackForSide(s.faction, s.tier ?? "outer")}
                  tier={s.tier ?? "outer"}
                />
              ) : (
                <StructureMesh kind={s.kind} faction={s.faction} />
              )}
              {s.kind !== "core" && (
                <group name="hpbar" position={[0, barY, 0]}>
                  <mesh position={[0, 0, -0.02]}>
                    <planeGeometry args={[2, 0.34]} />
                    <meshBasicMaterial color="#0a0604" transparent opacity={0.9} depthTest={false} depthWrite={false} />
                  </mesh>
                  <mesh position={[0, 0, -0.01]}>
                    <planeGeometry args={[1.88, 0.2]} />
                    <meshBasicMaterial color={s.faction === "ally" ? "#16310f" : "#3a1412"} depthTest={false} depthWrite={false} />
                  </mesh>
                  <mesh name="hpfill" position={[0, 0, 0]}>
                    <planeGeometry args={[1.8, 0.16]} />
                    <meshBasicMaterial color={barColor} depthTest={false} depthWrite={false} />
                  </mesh>
                </group>
              )}
            </group>
          );
        })}
    </>
  );
}
