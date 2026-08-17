/**
 * Danger Room 6-slot combat hotbar — Digit1–6, cooldown sweep, click-to-cast.
 */
import { useMemo } from "react";
import { useGame } from "../../game/store";
import { useRoster } from "../../game/roster";
import { useMeta } from "../../game/metaProgression";
import {
  abilityPoolForHero,
  isSlotUnlocked,
  resolveAbility,
  slotHotkey,
} from "../../game/abilityLoadout";
import "./dangerRoomHud.css";

export function DangerRoomHotbar({
  onCast,
}: {
  onCast?: (slotIndex: number) => void;
}) {
  const weaponSkillCd = useGame((s) => s.weaponSkillCd);
  const abilityCd = useGame((s) => s.abilityCd);
  const lastUsed = useGame((s) => s.lastUsedHotbarSlot);
  const prefabId = useRoster((s) => s.prefabId);
  const classId = useRoster((s) => s.classId);
  const meleeId = useRoster((s) => s.meleeId);
  const rangedId = useRoster((s) => s.rangedId);
  const slots = useRoster((s) => s.abilitySlots);
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

  return (
    <div className="dr-hotbar" role="toolbar" aria-label="Ability hotbar 1–6">
      {slots.map((id, i) => {
        const unlocked = isSlotUnlocked(i, Math.max(1, cardLevel));
        const ab = resolveAbility(id, pool);
        const cd =
          ab?.kind === "mobility" && ab.mobility
            ? abilityCd[ab.mobility] ?? 0
            : ab
              ? weaponSkillCd[ab.id] ?? 0
              : 0;
        const maxCd = Math.max(0.01, ab?.cooldown ?? 1);
        const pct = cd > 0 ? Math.min(100, (cd / maxCd) * 100) : 0;
        return (
          <button
            key={i}
            type="button"
            className={`dr-hotbar-slot${lastUsed === i + 1 ? " dr-hotbar-slot-active" : ""}${
              cd > 0 ? " on-cooldown" : ""
            }${unlocked ? "" : " is-locked"}`}
            title={
              ab
                ? `${ab.label} [${slotHotkey(i)}] — ${ab.description}`
                : unlocked
                  ? `Slot ${i + 1} empty`
                  : `Locked`
            }
            onClick={() => {
              if (!unlocked || !ab) return;
              if (onCast) onCast(i);
              else window.dispatchEvent(new KeyboardEvent("keydown", { code: `Digit${i + 1}`, bubbles: true }));
            }}
          >
            <div className="slot-num">{slotHotkey(i)}</div>
            <div className="slot-icon">{unlocked ? (ab?.icon ?? "·") : "🔒"}</div>
            <div className="slot-name">{ab?.label ?? (unlocked ? "—" : "lock")}</div>
            {cd > 0 && <div className="slot-cd" style={{ height: `${pct}%` }} />}
            {cd > 0 && <span className="slot-cd-num">{Math.ceil(cd)}</span>}
          </button>
        );
      })}
    </div>
  );
}
