/**
 * Tactical equipment paper-doll — matches design guide:
 *   slot 48px · gap 9px · pad 11px
 *   LEFT armor column · center race plate · RIGHT weapons/jewelry
 *
 * Guide: docs/references/tactical-equipment-race-cards.png
 */
import type { CSSProperties } from "react";
import {
  PAPER_DOLL_LEFT,
  PAPER_DOLL_RIGHT,
  RACE_CARD_LABEL,
  TACTICAL_EQUIP,
  normalizeRaceId,
  raceCardUrl,
  type PaperDollSlotDef,
  type RaceCardId,
} from "../../game/raceCardLayout";
import type { Equipment, LoadoutItem, SlotId } from "../../game/equipment";

export interface RacePaperDollProps {
  raceId: string;
  equipment: Equipment;
  activeSlot?: SlotId | null;
  onSlotClick?: (slot: SlotId) => void;
  /** Gold “+” bag button (inventory / open armory) */
  onBagClick?: () => void;
  showNames?: boolean;
  className?: string;
}

function slotTitle(item: LoadoutItem | undefined, label: string): string {
  return item ? `${label}: ${item.name}` : `${label} — empty`;
}

function SlotButton({
  def,
  item,
  active,
  onClick,
}: {
  def: PaperDollSlotDef;
  item?: LoadoutItem;
  active: boolean;
  onClick: () => void;
}) {
  const filled = !!item && !def.isAction;
  return (
    <button
      type="button"
      className={[
        "gw-race-doll-slot",
        `is-${def.side}`,
        `is-r${def.row + 1}`,
        filled ? "is-filled" : "",
        active ? "is-active" : "",
        def.isAction ? "is-action" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={def.isAction ? def.label : slotTitle(item, def.label)}
      aria-label={def.isAction ? def.label : slotTitle(item, def.label)}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="gw-race-doll-slot-inner" aria-hidden>
        {filled ? (
          <span className="gw-race-doll-slot-glyph">◆</span>
        ) : (
          <span className="gw-race-doll-slot-icon">{def.icon}</span>
        )}
      </span>
    </button>
  );
}

export function RacePaperDoll({
  raceId,
  equipment,
  activeSlot,
  onSlotClick,
  onBagClick,
  className = "",
}: RacePaperDollProps) {
  const race = normalizeRaceId(raceId);
  const bg = raceCardUrl(race);
  const label = RACE_CARD_LABEL[race];
  const { slotPx, gapPx, padPx } = TACTICAL_EQUIP;

  return (
    <div
      className={`gw-race-doll ${className}`.trim()}
      data-race={race}
      role="group"
      aria-label={`${label} tactical equipment`}
      style={
        {
          ["--td-slot" as string]: `${slotPx}px`,
          ["--td-gap" as string]: `${gapPx}px`,
          ["--td-pad" as string]: `${padPx}px`,
        } as CSSProperties
      }
    >
      <header className="gw-race-doll-head">
        <span className="gw-race-doll-brand">GRUDGE WARLORD</span>
        <span className="gw-race-doll-race">{label}</span>
      </header>

      <div className="gw-race-doll-grid">
        <div className="gw-race-doll-col is-left" aria-label="Armor slots">
          {PAPER_DOLL_LEFT.map((def) => (
            <SlotButton
              key={def.id}
              def={def}
              item={def.id !== "bag" ? equipment[def.id as SlotId] : undefined}
              active={activeSlot === def.id}
              onClick={() => {
                if (def.id === "bag") onBagClick?.();
                else onSlotClick?.(def.id as SlotId);
              }}
            />
          ))}
        </div>

        <div className="gw-race-doll-portrait">
          <img
            className="gw-race-doll-art"
            src={bg}
            alt={`Grudge Warlord — ${label}`}
            draggable={false}
          />
        </div>

        <div className="gw-race-doll-col is-right" aria-label="Weapon and jewel slots">
          {PAPER_DOLL_RIGHT.map((def) => (
            <SlotButton
              key={def.id}
              def={def}
              item={def.id !== "bag" ? equipment[def.id as SlotId] : undefined}
              active={activeSlot === def.id}
              onClick={() => {
                if (def.isAction || def.id === "bag") onBagClick?.();
                else onSlotClick?.(def.id as SlotId);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function raceCardPreviewList(): RaceCardId[] {
  return ["human", "orc", "elf", "dwarf", "barbarian", "undead"];
}
