import { useState } from "react";
import { useGame } from "../../game/store";
import { useRoster } from "../../game/roster";
import {
  MAX_HERO_LEVEL,
  PICK_LEVELS,
  xpBar,
  startingSkillId,
} from "../../game/heroSkillTree";
import { CLASS_BY_ID, classSkillById } from "@workspace/game-content";
import { ICONS } from "./icons";

/** Skill id held at a given hero level (1 = auto-grant, 2/4/6/8/10 = picks). */
function skillForLevel(heroSkillPicks: string[], level: number): string | null {
  if (level === 1) return heroSkillPicks[0] ?? null;
  const pickIdx = PICK_LEVELS.indexOf(level as (typeof PICK_LEVELS)[number]);
  if (pickIdx < 0) return null;
  return heroSkillPicks[pickIdx + 1] ?? null;
}

function isPickLevel(level: number): boolean {
  return level === 1 || (PICK_LEVELS as readonly number[]).includes(level);
}

/**
 * Persistent L1–10 hero progression track using Grudge unit-frame styling.
 * Collapsible; expands automatically when a skill pick is pending.
 */
export function HeroUpgradePanel() {
  const phase = useGame((s) => s.phase);
  const heroLevel = useGame((s) => s.heroLevel);
  const heroXp = useGame((s) => s.heroXp);
  const heroSkillPicks = useGame((s) => s.heroSkillPicks);
  const pending = useGame((s) => s.pendingSkillPick);
  const classId = useRoster((s) => s.classId);
  const [collapsed, setCollapsed] = useState(false);

  if (phase !== "battle") return null;

  const cls = CLASS_BY_ID[classId];
  const xp = xpBar(heroLevel, heroXp);
  const open = !collapsed || !!pending;
  const startId = startingSkillId(classId);

  return (
    <div className={`gw-hero-upgrades${open ? "" : " gw-hero-upgrades-collapsed"}`}>
      <button
        type="button"
        className="gw-hero-upgrades-head"
        onClick={() => setCollapsed((c) => !c)}
        title="Hero progression (levels 1–10)"
      >
        <img className="gw-title-icon" src={ICONS.cup} alt="" draggable={false} />
        <span className="gw-hero-upgrades-title">Champion Path</span>
        <span className="gw-hero-upgrades-lvl" style={{ color: cls.color }}>
          Lv {heroLevel}/{MAX_HERO_LEVEL}
        </span>
        {pending && <span className="gw-hero-upgrades-pending">Pick!</span>}
        <span className="gw-hero-upgrades-chevron">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="gw-hero-upgrades-body">
          <div className="gw-hero-xp-row">
            <span className="gw-hero-xp-label">
              {heroLevel >= MAX_HERO_LEVEL ? "Max level" : "Experience"}
            </span>
            <span className="gw-hero-xp-val">
              {heroLevel >= MAX_HERO_LEVEL ? "◆" : `${xp.cur} / ${xp.need}`}
            </span>
            <div className="gw-hero-xp-bar">
              <span style={{ width: `${xp.pct}%` }} />
            </div>
          </div>

          <div className="gw-hero-level-track">
            {Array.from({ length: MAX_HERO_LEVEL }, (_, i) => {
              const level = i + 1;
              const reached = heroLevel >= level;
              const isPick = isPickLevel(level);
              const skillId = skillForLevel(heroSkillPicks, level);
              const skill = skillId ? classSkillById(skillId) : null;
              const isPending = pending?.level === level;
              const isPassive = !isPick;

              let nodeLabel = "—";
              let nodeIcon = "·";
              if (level === 1 && !skill) {
                const start = classSkillById(startId);
                nodeLabel = start?.label ?? "Start";
                nodeIcon = start?.icon ?? "◆";
              } else if (skill) {
                nodeLabel = skill.label;
                nodeIcon = skill.icon ?? "◆";
              } else if (isPending) {
                nodeLabel = "Choose";
                nodeIcon = "?";
              } else if (isPassive && reached) {
                nodeLabel = "+Stats";
                nodeIcon = "↑";
              } else if (isPick && !reached) {
                nodeLabel = "Locked";
                nodeIcon = "◇";
              }

              return (
                <div
                  key={level}
                  className={[
                    "gw-hero-lvl-node",
                    reached ? "is-reached" : "",
                    isPick ? "is-pick" : "is-passive",
                    isPending ? "is-pending" : "",
                    skill ? "is-filled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={
                    skill
                      ? `${skill.label} — ${skill.description}`
                      : isPassive
                        ? `Level ${level} — passive stat growth`
                        : `Level ${level} skill pick`
                  }
                >
                  <span className="gw-hero-lvl-num">{level}</span>
                  <span className="gw-hero-lvl-icon" style={{ color: cls.color }}>
                    {nodeIcon}
                  </span>
                  <span className="gw-hero-lvl-name">{nodeLabel}</span>
                </div>
              );
            })}
          </div>

          {pending && (
            <p className="gw-hero-upgrades-hint">
              Level {pending.level} ready — choose a skill in the overlay.
            </p>
          )}
        </div>
      )}
    </div>
  );
}