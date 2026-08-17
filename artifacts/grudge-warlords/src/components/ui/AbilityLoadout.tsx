/**
 * Warcamp ability loadout — pick 6 hotbar skills before marching.
 * Unlocks follow hero card level. Nothing is chosen during the match.
 */
import { useMemo } from "react";
import { useRoster } from "../../game/roster";
import { useMeta } from "../../game/metaProgression";
import {
  abilityPoolForHero,
  isSlotUnlocked,
  resolveAbility,
  slotHotkey,
  type LoadoutAbility,
} from "../../game/abilityLoadout";
import "./dangerRoomHud.css";

export function AbilityLoadout() {
  const prefabId = useRoster((s) => s.prefabId);
  const classId = useRoster((s) => s.classId);
  const meleeId = useRoster((s) => s.meleeId);
  const rangedId = useRoster((s) => s.rangedId);
  const slots = useRoster((s) => s.abilitySlots);
  const setAbilitySlot = useRoster((s) => s.setAbilitySlot);
  const refillAbilitySlots = useRoster((s) => s.refillAbilitySlots);
  const cardLevel = useMeta((s) => s.characterLevel(prefabId));

  const pool = useMemo(
    () =>
      abilityPoolForHero({
        classId,
        meleeId,
        rangedId,
        cardLevel: Math.max(1, cardLevel),
      }),
    [classId, meleeId, rangedId, cardLevel],
  );

  const equipped = slots.map((id) => resolveAbility(id, pool));

  const assignToFirstEmpty = (ability: LoadoutAbility) => {
    const existing = slots.indexOf(ability.id);
    if (existing >= 0) {
      setAbilitySlot(existing, null);
      return;
    }
    const free = slots.findIndex((_, i) => isSlotUnlocked(i, cardLevel) && !slots[i]);
    if (free >= 0) setAbilitySlot(free, ability.id);
  };

  return (
    <div className="gw-ability-loadout">
      <div className="gw-ability-loadout-head">
        <span className="gw-deploy-head">Abilities · 6 slots</span>
        <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => refillAbilitySlots()}>
          Auto-fill
        </button>
      </div>
      <p className="gw-ability-loadout-hint">
        Card Lv {Math.max(1, cardLevel)} unlocks slots. Pick in the warcamp — not mid-fight. Keys 1–6.
      </p>

      <div className="dr-hotbar gw-ability-slots">
        {slots.map((id, i) => {
          const unlocked = isSlotUnlocked(i, cardLevel);
          const ab = equipped[i];
          return (
            <button
              key={i}
              type="button"
              className={`dr-hotbar-slot${ab ? " dr-hotbar-slot-active" : ""}${unlocked ? "" : " is-locked"}`}
              title={
                unlocked
                  ? ab
                    ? `${ab.label} — click to clear`
                    : `Slot ${i + 1} empty`
                  : `Unlocks at card level ${i === 0 || i === 1 ? 1 : i}`
              }
              onClick={() => unlocked && setAbilitySlot(i, null)}
            >
              <div className="slot-num">{slotHotkey(i)}</div>
              <div className="slot-icon">{unlocked ? (ab?.icon ?? "·") : "🔒"}</div>
              <div className="slot-name">{unlocked ? (ab?.label ?? "empty") : "locked"}</div>
            </button>
          );
        })}
      </div>

      <div className="gw-ability-pool">
        {pool.map((ab) => {
          const on = slots.includes(ab.id);
          return (
            <button
              key={ab.id}
              type="button"
              className={`gw-ability-chip${on ? " is-on" : ""}`}
              title={ab.description}
              onClick={() => assignToFirstEmpty(ab)}
            >
              <span className="gw-ability-chip-kind">{ab.kind}</span>
              <span className="gw-ability-chip-name">{ab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
