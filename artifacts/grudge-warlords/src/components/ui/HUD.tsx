import { useGame } from "../../game/store";
import { useCommand } from "../../game/command";
import { useRoster } from "../../game/roster";
import { useWeaponTuning, type TuningField } from "../../game/weaponTuning";
import { getPreset, isMeleeWeapon } from "../../game/anim/presets";
import { EM } from "../../game/entities";
import { ABILITIES, type AbilityId } from "../../game/config";
import { MAX_HERO_LEVEL, xpBar } from "../../game/heroSkillTree";
import { warlordSkillsForLoadout } from "../../game/warlordWeaponSkills";
import { CLASS_BY_ID } from "@workspace/game-content";
import type { MeleeWeaponId, RangedWeaponId } from "../../game/config";
import { Shop } from "./Shop";
import { LaneDeployment } from "./LaneDeployment";
import { HeroUpgradePanel } from "./HeroUpgradePanel";
import { ProductionBuildingPanel } from "./ProductionBuildingPanel";
import { BuildBar } from "./BuildBar";
import { PortraitFrame, BarFrame } from "./UnitFrame";

const ABILITY_ORDER: AbilityId[] = ["dash", "slam"];

/** Level-up skill picker — class-branched, resets each match. */
function SkillTreePicker() {
  const pending = useGame((s) => s.pendingSkillPick);
  const pickHeroSkill = useGame((s) => s.pickHeroSkill);
  const classId = useRoster((s) => s.classId);
  if (!pending) return null;
  const cls = CLASS_BY_ID[classId];
  return (
    <div className="gw-skilltree-overlay">
      <div className="gw-skilltree">
        <div className="gw-skilltree-head">
          <span className="gw-skilltree-title">Level {pending.level} — Choose a Skill</span>
          <span className="gw-skilltree-class" style={{ color: cls.color }}>
            {cls.name}
          </span>
        </div>
        <div className="gw-skilltree-options">
          {pending.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="gw-skilltree-opt"
              style={{ borderColor: opt.color }}
              onClick={() => pickHeroSkill(opt.id)}
            >
              <span className="gw-skilltree-icon" style={{ color: opt.color }}>
                {opt.icon ?? "◆"}
              </span>
              <span className="gw-skilltree-name">{opt.label}</span>
              <span className="gw-skilltree-desc">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Canonical GRUDGE6 weapon-skill hotbar (Digit1–6 / API matrix). */
function WeaponSkillsBar() {
  const weaponSkillCd = useGame((s) => s.weaponSkillCd);
  const activeWeapon = useGame((s) => s.heroActiveWeapon);
  const meleeId = useRoster((s) => s.meleeId) as MeleeWeaponId;
  const rangedId = useRoster((s) => s.rangedId) as RangedWeaponId;
  const skills = warlordSkillsForLoadout(meleeId, rangedId, activeWeapon);
  if (!skills.length) return null;
  return (
    <div className="gw-weapon-skills">
      {skills.map((sk) => {
        const cd = weaponSkillCd[sk.id] ?? 0;
        const ready = cd <= 0;
        const pct = ready || sk.cooldown <= 0 ? 0 : (cd / sk.cooldown) * 100;
        return (
          <div
            key={sk.id}
            className={`gw-weapon-skill ${ready ? "is-ready" : "is-cooling"}`}
            title={`${sk.label} — ${sk.damage} dmg · ${sk.description}`}
          >
            <div className="gw-weapon-skill-icon">
              <span className="gw-weapon-skill-key">{sk.keyLabel}</span>
              <span className="gw-weapon-skill-cool" style={{ height: `${pct}%` }} />
              {!ready && sk.cooldown > 0 && (
                <span className="gw-weapon-skill-timer">{Math.ceil(cd)}</span>
              )}
            </div>
            <span className="gw-weapon-skill-name">{sk.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Hero ability bar: shows each skill's hotkey, name, and live cooldown sweep. */
function SkillsBar() {
  const abilityCd = useGame((s) => s.abilityCd);
  return (
    <div className="gw-skills">
      {ABILITY_ORDER.map((id) => {
        const def = ABILITIES[id];
        const cd = abilityCd[id];
        const ready = cd <= 0;
        const pct = ready ? 0 : (cd / def.cooldown) * 100;
        return (
          <div key={id} className={`gw-skill ${ready ? "is-ready" : "is-cooling"}`}>
            <div className="gw-skill-icon" style={{ borderColor: def.color }}>
              <span className="gw-skill-key">{def.key}</span>
              <span className="gw-skill-cool" style={{ height: `${pct}%` }} />
              {!ready && <span className="gw-skill-timer">{Math.ceil(cd)}</span>}
            </div>
            <span className="gw-skill-name" style={{ color: ready ? def.color : undefined }}>
              {def.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Marquee() {
  const m = useCommand((s) => s.marquee);
  if (!m.active) return null;
  const left = Math.min(m.x0, m.x1);
  const top = Math.min(m.y0, m.y1);
  const width = Math.abs(m.x1 - m.x0);
  const height = Math.abs(m.y1 - m.y0);
  return <div className="gw-marquee" style={{ left, top, width, height }} />;
}

const ORDERS: { key: string; label: string }[] = [
  { key: "A", label: "Attack" },
  { key: "M", label: "Move" },
  { key: "H", label: "Hold" },
  { key: "S", label: "Stop" },
  { key: "1–5", label: "Fortify" },
];

/** Aggregate the live selection into per-type counts for the selection panel. */
function selectionSummary(ids: number[]): { name: string; count: number }[] {
  const byName = new Map<string, number>();
  const set = new Set(ids);
  for (const u of EM.units) {
    if (!u.alive || !set.has(u.id)) continue;
    byName.set(u.def.name, (byName.get(u.def.name) ?? 0) + 1);
  }
  return [...byName.entries()].map(([name, count]) => ({ name, count }));
}

/** Dev-style weapon placement panel: live-edits the equipped model's tuning. */
const TUNE_ROWS: { label: string; fields: [TuningField, TuningField, TuningField]; step: number }[] = [
  { label: "Position", fields: ["px", "py", "pz"], step: 0.01 },
  { label: "Rotation", fields: ["rx", "ry", "rz"], step: 0.05 },
  { label: "Muzzle", fields: ["mx", "my", "mz"], step: 0.01 },
];

function WeaponTuningPanel() {
  const editorOpen = useWeaponTuning((s) => s.editorOpen);
  const activeKey = useWeaponTuning((s) => s.activeKey);
  const tuning = useWeaponTuning((s) => (activeKey ? s.tuning[activeKey] : null));
  const setField = useWeaponTuning((s) => s.setField);
  const reset = useWeaponTuning((s) => s.reset);

  if (!editorOpen || !activeKey || !tuning) return null;

  return (
    <div className="gw-tuner">
      <div className="gw-tuner-head">
        <span className="gw-tuner-title">{activeKey.toUpperCase()} PLACEMENT</span>
        <span className="gw-tuner-hint">P to close</span>
      </div>
      {TUNE_ROWS.map((row) => (
        <div key={row.label} className="gw-tuner-row">
          <span className="gw-tuner-label">{row.label}</span>
          {row.fields.map((f) => (
            <input
              key={f}
              type="number"
              className="gw-tuner-input"
              step={row.step}
              value={tuning[f]}
              onChange={(e) => setField(activeKey, f, Number(e.target.value))}
            />
          ))}
        </div>
      ))}
      <div className="gw-tuner-row">
        <span className="gw-tuner-label">Scale</span>
        <input
          type="number"
          className="gw-tuner-input"
          step={0.05}
          value={tuning.scale}
          onChange={(e) => setField(activeKey, "scale", Number(e.target.value))}
        />
        <button type="button" className="gw-tuner-reset" onClick={() => reset(activeKey)}>
          Reset
        </button>
      </div>
    </div>
  );
}

/** Mid-game objective readout: current goal, citadel gating, the recurring relic
 *  cycle (with live capture progress), and active army buffs / comeback / tech. */
function ObjectivePanel() {
  const objectiveLabel = useGame((s) => s.objectiveLabel);
  const enemyCoreOpen = useGame((s) => s.enemyCoreOpen);
  const allyCoreExposed = useGame((s) => s.allyCoreExposed);
  const relicPhase = useGame((s) => s.relicPhase);
  const relicTimer = useGame((s) => s.relicTimer);
  const relicProgress = useGame((s) => s.relicProgress);
  const relicCapturer = useGame((s) => s.relicCapturer);
  const buffAllyTimer = useGame((s) => s.buffAllyTimer);
  const buffEnemyTimer = useGame((s) => s.buffEnemyTimer);
  const comebackAlly = useGame((s) => s.comebackAlly);
  const allyTech = useGame((s) => s.allyTech);

  const relicActive = relicPhase === "active";
  const captureNote = relicCapturer
    ? relicCapturer === "ally"
      ? "You are claiming it…"
      : "Enemy is claiming it…"
    : "Hold the centre to claim";

  // Only block center FOV for critical state — idle relic countdown stays out of the way
  const critical =
    allyCoreExposed ||
    enemyCoreOpen ||
    relicActive ||
    buffAllyTimer > 0 ||
    buffEnemyTimer > 0 ||
    comebackAlly;

  if (!critical && !objectiveLabel) return null;

  return (
    <div className={`gw-objective${critical ? " is-critical" : " is-quiet"}`}>
      {critical && objectiveLabel && (
        <div className="gw-obj-main">
          <span className="gw-obj-label">Objective</span>
          <span className="gw-obj-text">{objectiveLabel}</span>
        </div>
      )}
      {allyCoreExposed && <div className="gw-obj-warn">YOUR CITADEL IS EXPOSED</div>}
      {enemyCoreOpen && <div className="gw-obj-good">ENEMY CITADEL OPEN</div>}

      {relicActive && (
        <div className="gw-relic gw-relic-active">
          <span className="gw-relic-title">RELIC</span>
          <span className="gw-relic-sub">{captureNote} · {relicTimer}s</span>
          <div className="gw-relic-bar">
            <span
              style={{
                width: `${Math.round(relicProgress * 100)}%`,
                background: relicCapturer === "enemy" ? "#e0584a" : "#f0c46b",
              }}
            />
          </div>
        </div>
      )}

      {(buffAllyTimer > 0 || buffEnemyTimer > 0 || comebackAlly || allyTech > 0) && (
        <div className="gw-obj-tags">
          {buffAllyTimer > 0 && <span className="gw-tag gw-tag-good">Might {buffAllyTimer}s</span>}
          {buffEnemyTimer > 0 && <span className="gw-tag gw-tag-bad">Enemy {buffEnemyTimer}s</span>}
          {comebackAlly && <span className="gw-tag gw-tag-good">Rally</span>}
          {allyTech > 0 && <span className="gw-tag">Tech T{allyTech}</span>}
        </div>
      )}
    </div>
  );
}

export function HUD() {
  const phase = useGame((s) => s.phase);
  const health = useGame((s) => s.health);
  const maxHealth = useGame((s) => s.maxHealth);
  const ammo = useGame((s) => s.ammo);
  const reserve = useGame((s) => s.reserve);
  const magazine = useGame((s) => s.magazine);
  const reloading = useGame((s) => s.reloading);
  const credits = useGame((s) => s.credits);
  const score = useGame((s) => s.score);
  const kills = useGame((s) => s.kills);
  const heroLevel = useGame((s) => s.heroLevel);
  const heroXp = useGame((s) => s.heroXp);
  const classId = useRoster((s) => s.classId);
  const heroId = useRoster((s) => s.heroId);
  const xp = xpBar(heroLevel, heroXp);
  const heroPreset = getPreset(heroId);
  const heroMelee = isMeleeWeapon(heroPreset.weapon);
  const allyCoreHp = useGame((s) => s.allyCoreHp);
  const allyCoreMax = useGame((s) => s.allyCoreMax);
  const enemyCoreHp = useGame((s) => s.enemyCoreHp);
  const enemyCoreMax = useGame((s) => s.enemyCoreMax);
  const heroDead = useGame((s) => s.heroDead);
  const respawnTimer = useGame((s) => s.respawnTimer);
  const messages = useGame((s) => s.messages);
  const mode = useCommand((s) => s.mode);
  const selection = useCommand((s) => s.selection);
  const armedBuild = useCommand((s) => s.build);

  if (phase !== "battle") return null;

  const summary = mode === "command" && selection.length ? selectionSummary(selection) : [];
  const isCombat = mode === "combat";
  const isCommand = mode === "command";

  return (
    <div className={`gw-hud gk-root gk-combat-hud gw-moba-battle gw-mode-${mode}`}>
      {/* Crosshair only in FPS combat — not during RTS command */}
      {isCombat && (
        <div className="gw-crosshair" aria-hidden>
          <span /><span /><span /><span />
        </div>
      )}

      <Marquee />
      <SkillTreePicker />

      {armedBuild && isCommand && (
        <div className="gw-build-banner">
          <span className="gw-build-label">Placing</span>
          <span className="gw-build-name">{armedBuild.ref.toUpperCase()}</span>
          <span className="gw-build-hint">Click terrain · Esc cancel · 1–5 switch</span>
        </div>
      )}

      {/* Compact mode pill — top-left, not center-blocking */}
      <div className={`gw-mode-badge gw-mode-badge-${mode}`}>
        <span className="gw-mode-key">`</span>
        <span className="gw-mode-text">{isCombat ? "COMBAT" : "COMMAND"}</span>
        {isCommand && selection.length > 0 && (
          <span className="gw-mode-sel">{selection.length}</span>
        )}
      </div>

      {/* Top bar: citadel HP only — score tucked small */}
      <div className="gw-top">
        <PortraitFrame
          variant="lg"
          crest="#e0b252"
          label="Ally Core"
          value={`${Math.ceil(allyCoreHp)}`}
          pct={(allyCoreHp / Math.max(1, allyCoreMax)) * 100}
          fill="green"
        />
        <div className="gw-top-center-meta">
          <span className="gw-vs">VS</span>
          <span className="gw-score-inline">{score} · {kills} kills</span>
        </div>
        <PortraitFrame
          variant="lg"
          crest="#c0392b"
          label="Enemy Core"
          value={`${Math.ceil(enemyCoreHp)}`}
          pct={(enemyCoreHp / Math.max(1, enemyCoreMax)) * 100}
          fill="red"
        />
      </div>

      {/* Objective only when critical (exposed core / relic active / vulnerable) */}
      <ObjectivePanel />

      {heroDead && (
        <div className="gw-status">
          <div className="gw-respawn">
            <span className="gw-respawn-title">FALLEN</span>
            <span className="gw-respawn-sub">Respawn {Math.ceil(respawnTimer)}s</span>
          </div>
        </div>
      )}

      <div className="gw-messages">
        {messages.map((m) => (
          <div key={m.id} className={`gw-msg gw-msg-${m.kind}`}>{m.text}</div>
        ))}
      </div>

      {summary.length > 0 && (
        <div className="gw-selection">
          {summary.map((s) => (
            <div key={s.name} className="gw-sel-item">
              <span className="gw-sel-count">{s.count}</span>
              <span className="gw-sel-name">{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Player frame — bottom-left */}
      <div className="gw-bottom-left">
        <PortraitFrame
          variant="sm"
          crest={CLASS_BY_ID[classId].color}
          level={String(heroLevel)}
          label={`Lv ${heroLevel}`}
          value={`${Math.ceil(health)} / ${Math.ceil(maxHealth)}`}
          pct={(health / Math.max(1, maxHealth)) * 100}
          fill={health > maxHealth * 0.35 ? "green" : "orange"}
        />
        <BarFrame
          label={heroLevel >= MAX_HERO_LEVEL ? "MAX" : "XP"}
          value={heroLevel >= MAX_HERO_LEVEL ? "◆" : `${xp.cur}/${xp.need}`}
          pct={xp.pct}
          fill="orange"
        />
        {isCommand && (
          <div className="gw-orders">
            {ORDERS.map((o) => (
              <div key={o.key} className="gw-order">
                <span className="gw-key">{o.key}</span>
                <span>{o.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Single combat action strip: weapon skills + dash/slam */}
      {isCombat && (
        <div className="gw-action-strip">
          <WeaponSkillsBar />
          <SkillsBar />
        </div>
      )}

      {isCombat && <WeaponTuningPanel />}

      <div className="gw-bottom-right">
        {heroMelee ? (
          <BarFrame label={heroPreset.weaponLabel.toUpperCase()} value="∞" pct={100} fill="blue" />
        ) : (
          <BarFrame
            label={reloading ? "RELOAD" : "AMMO"}
            value={reloading ? "··" : `${ammo}/${reserve}`}
            pct={reloading ? 0 : (ammo / Math.max(1, magazine)) * 100}
            fill="blue"
          />
        )}
        <div className="gw-credits"><span className="gw-cr-icon">◈</span> {credits}</div>
      </div>

      {/* RTS panels only in command mode — keep combat FOV clean */}
      {isCommand && (
        <>
          <HeroUpgradePanel />
          <ProductionBuildingPanel />
          <LaneDeployment />
          <BuildBar />
          <Shop />
        </>
      )}
    </div>
  );
}
