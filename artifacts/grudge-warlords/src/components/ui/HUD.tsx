import { useGame } from "../../game/store";
import { useCommand } from "../../game/command";
import { useRoster } from "../../game/roster";
import { useWeaponTuning, type TuningField } from "../../game/weaponTuning";
import { getPreset, isMeleeWeapon } from "../../game/anim/presets";
import { EM } from "../../game/entities";
import { ABILITIES, DIFFICULTY, type AbilityId } from "../../game/config";
import { Shop } from "./Shop";
import { PortraitFrame, BarFrame } from "./UnitFrame";

const ABILITY_ORDER: AbilityId[] = ["dash", "slam"];

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
  { key: "B", label: "Build" },
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

  return (
    <div className="gw-objective">
      {objectiveLabel && (
        <div className="gw-obj-main">
          <span className="gw-obj-label">Objective</span>
          <span className="gw-obj-text">{objectiveLabel}</span>
        </div>
      )}
      {allyCoreExposed && <div className="gw-obj-warn">⚠ YOUR CITADEL IS EXPOSED</div>}
      {enemyCoreOpen && <div className="gw-obj-good">ENEMY CITADEL VULNERABLE</div>}

      <div className={`gw-relic${relicActive ? " gw-relic-active" : ""}`}>
        <span className="gw-relic-title">⬡ {relicActive ? "RELIC RISEN" : "Relic"}</span>
        <span className="gw-relic-sub">
          {relicActive ? `${captureNote} · ${relicTimer}s` : `Rises in ${relicTimer}s`}
        </span>
        {relicActive && (
          <div className="gw-relic-bar">
            <span
              style={{
                width: `${Math.round(relicProgress * 100)}%`,
                background: relicCapturer === "enemy" ? "#e0584a" : "#f0c46b",
              }}
            />
          </div>
        )}
      </div>

      <div className="gw-obj-tags">
        {buffAllyTimer > 0 && <span className="gw-tag gw-tag-good">Relic Might {buffAllyTimer}s</span>}
        {buffEnemyTimer > 0 && <span className="gw-tag gw-tag-bad">Enemy Might {buffEnemyTimer}s</span>}
        {comebackAlly && <span className="gw-tag gw-tag-good">Rally Bonus</span>}
        {allyTech > 0 && <span className="gw-tag">Army Tech T{allyTech}</span>}
      </div>
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
  const heroId = useRoster((s) => s.heroId);
  const heroPreset = getPreset(heroId);
  const heroMelee = isMeleeWeapon(heroPreset.weapon);
  const allyCoreHp = useGame((s) => s.allyCoreHp);
  const allyCoreMax = useGame((s) => s.allyCoreMax);
  const enemyCoreHp = useGame((s) => s.enemyCoreHp);
  const enemyCoreMax = useGame((s) => s.enemyCoreMax);
  const difficulty = useGame((s) => s.difficulty);
  const heroDead = useGame((s) => s.heroDead);
  const respawnTimer = useGame((s) => s.respawnTimer);
  const messages = useGame((s) => s.messages);
  const mode = useCommand((s) => s.mode);
  const selection = useCommand((s) => s.selection);
  const armedBuild = useCommand((s) => s.build);

  if (phase !== "battle") return null;

  const summary = mode === "command" && selection.length ? selectionSummary(selection) : [];

  return (
    <div className={`gw-hud gw-mode-${mode}`}>
      <div className="gw-crosshair">
        <span /><span /><span /><span />
      </div>

      <Marquee />

      {armedBuild && mode === "command" && (
        <div className="gw-build-banner">
          <span className="gw-build-label">Placing</span>
          <span className="gw-build-name">{armedBuild.ref.toUpperCase()}</span>
          <span className="gw-build-hint">Click terrain · Esc cancel · B another build</span>
        </div>
      )}

      <div className={`gw-mode-badge gw-mode-badge-${mode}`}>
        <span className="gw-mode-key">`</span>
        <span className="gw-mode-text">{mode === "combat" ? "WARRIOR" : "WARLORD"}</span>
        {mode === "command" && selection.length > 0 && (
          <span className="gw-mode-sel">{selection.length} SELECTED</span>
        )}
      </div>

      {/* Citadels */}
      <div className="gw-top">
        <PortraitFrame
          variant="lg"
          crest="#e0b252"
          label="Your Citadel"
          value={`${Math.ceil(allyCoreHp)} / ${allyCoreMax}`}
          pct={(allyCoreHp / allyCoreMax) * 100}
          fill="green"
        />
        <span className="gw-vs">VS</span>
        <PortraitFrame
          variant="lg"
          crest="#c0392b"
          label="Enemy Citadel"
          value={`${Math.ceil(enemyCoreHp)} / ${enemyCoreMax}`}
          pct={(enemyCoreHp / enemyCoreMax) * 100}
          fill="red"
        />
        <div className="gw-panel gw-score">
          <span className="gw-label">Score</span>
          <span className="gw-value">{score}</span>
        </div>
        <div className={`gw-panel gw-difficulty gw-difficulty-${difficulty}`}>
          <span className="gw-label">Difficulty</span>
          <span className="gw-value">{DIFFICULTY[difficulty].name}</span>
        </div>
      </div>

      <ObjectivePanel />

      {/* Respawn banner */}
      {heroDead && (
        <div className="gw-status">
          <div className="gw-respawn">
            <span className="gw-respawn-title">YOU HAVE FALLEN</span>
            <span className="gw-respawn-sub">Returning in {Math.ceil(respawnTimer)}s</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="gw-messages">
        {messages.map((m) => (
          <div key={m.id} className={`gw-msg gw-msg-${m.kind}`}>{m.text}</div>
        ))}
      </div>

      {/* Selection panel */}
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

      {/* Bottom-left: hero armor + command legend */}
      <div className="gw-bottom-left">
        <PortraitFrame
          variant="sm"
          crest="#e7c873"
          level={String(kills)}
          label="Hero Vigor"
          value={String(Math.ceil(health))}
          pct={(health / maxHealth) * 100}
          fill={health > maxHealth * 0.35 ? "green" : "orange"}
        />
        {mode === "command" && (
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

      {/* Hero ability cooldowns (combat only) */}
      {mode === "combat" && <SkillsBar />}

      {/* Weapon placement tuner (combat only, toggled with P) */}
      {mode === "combat" && <WeaponTuningPanel />}

      {/* Bottom-right: ammo (ranged) or weapon label (melee) + credits */}
      <div className="gw-bottom-right">
        {heroMelee ? (
          <BarFrame label={heroPreset.weaponLabel.toUpperCase()} value="∞" pct={100} fill="blue" />
        ) : (
          <BarFrame
            label={reloading ? "RELOADING" : "QUIVER"}
            value={reloading ? "··" : `${ammo} / ${reserve}`}
            pct={reloading ? 0 : (ammo / magazine) * 100}
            fill="blue"
          />
        )}
        <div className="gw-credits"><span className="gw-cr-icon">◈</span> {credits}</div>
        <span className="gw-sub">{kills} SLAIN</span>
      </div>

      {/* Shop */}
      <Shop />
    </div>
  );
}
