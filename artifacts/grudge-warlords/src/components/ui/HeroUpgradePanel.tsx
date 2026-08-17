import { useState } from "react";
import { useGame } from "../../game/store";
import { useRoster } from "../../game/roster";
import { MAX_HERO_LEVEL, xpBar } from "../../game/heroSkillTree";
import { CLASS_BY_ID } from "@workspace/game-content";
import { ICONS } from "./icons";
import {
  abilityPoolForHero,
  resolveAbility,
  slotHotkey,
} from "../../game/abilityLoadout";
import { useMeta } from "../../game/metaProgression";

/**
 * Persistent L1–10 hero progression track using Grudge unit-frame styling.
 * Collapsible; expands automatically when a skill pick is pending.
 */
export function HeroUpgradePanel() {
  const phase = useGame((s) => s.phase);
  const heroLevel = useGame((s) => s.heroLevel);
  const heroXp = useGame((s) => s.heroXp);
  const classId = useRoster((s) => s.classId);
  const meleeId = useRoster((s) => s.meleeId);
  const rangedId = useRoster((s) => s.rangedId);
  const prefabId = useRoster((s) => s.prefabId);
  const slots = useRoster((s) => s.abilitySlots);
  const cardLevel = useMeta((s) => s.characterLevel(prefabId));
  const [collapsed, setCollapsed] = useState(false);

  if (phase !== "battle") return null;

  const cls = CLASS_BY_ID[classId];
  const xp = xpBar(heroLevel, heroXp);
  const open = !collapsed;
  const pool = abilityPoolForHero({
    classId,
    meleeId,
    rangedId,
    cardLevel: Math.max(1, cardLevel),
  });

  return (
    <div className={`gw-hero-upgrades${open ? "" : " gw-hero-upgrades-collapsed"}`}>
      <button
        type="button"
        className="gw-hero-upgrades-head"
        onClick={() => setCollapsed((c) => !c)}
        title="Warcamp abilities (keys 1–6)"
      >
        <img className="gw-title-icon" src={ICONS.cup} alt="" draggable={false} />
        <span className="gw-hero-upgrades-title">Warcamp Loadout</span>
        <span className="gw-hero-upgrades-lvl" style={{ color: cls.color }}>
          Lv {heroLevel}/{MAX_HERO_LEVEL}
        </span>
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
            {slots.map((id, i) => {
              const ab = resolveAbility(id, pool);
              return (
                <div
                  key={i}
                  className={`gw-hero-lvl-node is-pick${ab ? " is-filled is-reached" : ""}`}
                  title={ab ? `${ab.label} — ${ab.description}` : `Slot ${i + 1} empty`}
                >
                  <span className="gw-hero-lvl-num">{slotHotkey(i)}</span>
                  <span className="gw-hero-lvl-icon" style={{ color: cls.color }}>
                    {ab?.icon ?? "·"}
                  </span>
                  <span className="gw-hero-lvl-name">{ab?.label ?? "—"}</span>
                </div>
              );
            })}
          </div>

          <p className="gw-hero-upgrades-hint">
            Abilities were chosen in the warcamp. Levels here only add stats.
          </p>
        </div>
      )}
    </div>
  );
}