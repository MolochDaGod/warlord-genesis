import { useEffect, useMemo, useState } from "react";
import { useRoster } from "../../game/roster";
import {
  SLOTS,
  loadEquipmentItems,
  computeLoadoutStats,
  statAtTier,
  type LoadoutItem,
  type SlotId,
} from "../../game/equipment";
import { RANGED_WEAPONS, MELEE_WEAPONS_CFG } from "../../game/config";
import { getTierColor } from "../../lib/grudgeData";
import { canonicalWeaponsForPrefab, meleeDisplayName } from "../../game/canonicalLoadout";
import { useMeta } from "../../game/metaProgression";

const RANGED_LIST = Object.values(RANGED_WEAPONS);
const MELEE_LIST = Object.values(MELEE_WEAPONS_CFG);

export function Loadout() {
  const equipment = useRoster((s) => s.equipment);
  const gearTier = useRoster((s) => s.gearTier);
  const equip = useRoster((s) => s.equip);
  const unequip = useRoster((s) => s.unequip);
  const setGearTier = useRoster((s) => s.setGearTier);
  const prefabId = useRoster((s) => s.prefabId);
  const meleeId = useRoster((s) => s.meleeId);
  const rangedId = useRoster((s) => s.rangedId);
  const setMelee = useRoster((s) => s.setMelee);
  const setRanged = useRoster((s) => s.setRanged);
  const maxGearTier = useMeta((s) => s.maxGearTierForPrefab(prefabId));
  const canonical = canonicalWeaponsForPrefab(prefabId);

  const [items, setItems] = useState<LoadoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<SlotId>("weapon");

  useEffect(() => {
    if (gearTier > maxGearTier) setGearTier(maxGearTier);
  }, [gearTier, maxGearTier, setGearTier]);

  useEffect(() => {
    let cancelled = false;
    loadEquipmentItems()
      .then((all) => {
        if (cancelled) return;
        setItems(all);
        // Auto-fill empty paper-doll slots with first item per slot (warcamp default kit).
        const eq = useRoster.getState().equipment;
        const bySlot = new Map<string, typeof all[0]>();
        for (const it of all) {
          if (!bySlot.has(it.slot)) bySlot.set(it.slot, it);
        }
        for (const [slot, it] of bySlot) {
          if (!eq[slot as keyof typeof eq]) {
            useRoster.getState().equip(slot as Parameters<typeof equip>[0], it);
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load gear");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [equip]);

  const slotItems = useMemo(
    () => items.filter((it) => it.slot === activeSlot),
    [items, activeSlot],
  );

  const stats = useMemo(
    () => computeLoadoutStats(equipment, gearTier),
    [equipment, gearTier],
  );

  const tier = getTierColor(gearTier);

  return (
    <div className="gw-lo">
      <div className="gw-lo-head">
        <span className="gw-lo-title">EQUIP BEFORE THE ROUND</span>
        <span className="gw-lo-tier-label" style={{ opacity: 0.7 }}>
          CANONICAL KIT LOCKED · Q SWAPS IN BATTLE · UPGRADE CARD FOR HIGHER TIERS
        </span>
      </div>
      <div className="gw-lo-weapons">
        <div className="gw-lo-wcol">
          <span className="gw-lo-wlabel gw-stat-dmg">MELEE</span>
          <div className="gw-lo-wlist">
            {MELEE_LIST.map((w) => (
              <button
                key={w.id}
                className={`gw-lo-wbtn${w.id === meleeId ? " is-equipped" : ""}${w.id !== canonical.melee ? " is-locked" : ""}`}
                onClick={() => w.id === canonical.melee && setMelee(w.id)}
                disabled={w.id !== canonical.melee}
              >
                <span className="gw-lo-item-name">
                  {w.id === canonical.melee ? meleeDisplayName(prefabId, w.id) : w.name}
                </span>
                <span className="gw-lo-item-stats">
                  <span className="gw-stat-dmg">{w.damage} DMG</span>
                  {w.block && <span className="gw-stat-def">BLOCK</span>}
                  <span className="gw-stat-cls">{w.style}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="gw-lo-wcol">
          <span className="gw-lo-wlabel gw-stat-hp">RANGED</span>
          <div className="gw-lo-wlist">
            {RANGED_LIST.map((w) => (
              <button
                key={w.id}
                className={`gw-lo-wbtn${w.id === rangedId ? " is-equipped" : ""}${w.id !== canonical.ranged ? " is-locked" : ""}`}
                onClick={() => w.id === canonical.ranged && setRanged(w.id)}
                disabled={w.id !== canonical.ranged}
              >
                <span className="gw-lo-item-name">{w.name}</span>
                <span className="gw-lo-item-stats">
                  {w.damage > 0 && <span className="gw-stat-dmg">{w.damage} DMG</span>}
                  <span className="gw-stat-cls">{w.mode}</span>
                  {w.pellets > 1 && <span className="gw-stat-def">x{w.pellets}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="gw-lo-head">
        <span className="gw-lo-title">WAR GEAR</span>
        <div className="gw-lo-tier">
          <span className="gw-lo-tier-label" style={{ color: tier.hex }}>
            TIER {gearTier} · {tier.label} (max T{maxGearTier} from card)
          </span>
          <input
            type="range"
            min={1}
            max={maxGearTier}
            step={1}
            value={Math.min(gearTier, maxGearTier)}
            onChange={(e) => setGearTier(Number(e.target.value))}
            style={{ accentColor: tier.hex }}
          />
        </div>
      </div>

      <div className="gw-lo-body">
        <div className="gw-lo-slots">
          {SLOTS.map((s) => {
            const it = equipment[s.id];
            return (
              <button
                key={s.id}
                className={`gw-lo-slot${s.id === activeSlot ? " is-active" : ""}${
                  it ? " is-filled" : ""
                }`}
                onClick={() => setActiveSlot(s.id)}
              >
                <span className="gw-lo-slot-name">{s.name}</span>
                <span className="gw-lo-slot-item">{it ? it.name : "— empty —"}</span>
              </button>
            );
          })}
        </div>

        <div className="gw-lo-picker">
          {loading && <div className="gw-lo-status">Loading the armory…</div>}
          {error && <div className="gw-form-error">{error}</div>}
          {!loading && !error && (
            <>
              <div className="gw-lo-picker-head">
                <span>{SLOTS.find((s) => s.id === activeSlot)?.name}</span>
                {equipment[activeSlot] && (
                  <button className="gw-lo-clear" onClick={() => unequip(activeSlot)}>
                    Unequip
                  </button>
                )}
              </div>
              <div className="gw-lo-list">
                {slotItems.map((it) => {
                  const equipped = equipment[activeSlot]?.id === it.id;
                  const hp = statAtTier(it, "hpBase", "hpPerTier", gearTier);
                  const def = statAtTier(it, "defenseBase", "defensePerTier", gearTier);
                  const dmg = statAtTier(it, "damageBase", "damagePerTier", gearTier);
                  return (
                    <button
                      key={it.id}
                      className={`gw-lo-item${equipped ? " is-equipped" : ""}`}
                      onClick={() => equip(activeSlot, it)}
                    >
                      <div className="gw-lo-item-top">
                        <span className="gw-lo-item-name">{it.name}</span>
                        <span className="gw-lo-item-cat">{it.category}</span>
                      </div>
                      <div className="gw-lo-item-stats">
                        {dmg > 0 && <span className="gw-stat-dmg">{dmg} DMG</span>}
                        {hp > 0 && <span className="gw-stat-hp">+{hp} HP</span>}
                        {def > 0 && <span className="gw-stat-def">+{def} DEF</span>}
                        {it.weaponClass && (
                          <span className="gw-stat-cls">{it.weaponClass}</span>
                        )}
                      </div>
                      {it.lore && <div className="gw-lo-item-lore">{it.lore}</div>}
                    </button>
                  );
                })}
                {slotItems.length === 0 && (
                  <div className="gw-lo-status">No gear available for this slot.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="gw-lo-summary">
        <div className="gw-lo-sum">
          <span className="gw-lo-sum-val">+{stats.bonusHp}</span>
          <span className="gw-lo-sum-key">Max HP</span>
        </div>
        <div className="gw-lo-sum">
          <span className="gw-lo-sum-val">{stats.damageMult.toFixed(2)}×</span>
          <span className="gw-lo-sum-key">Damage</span>
        </div>
        <div className="gw-lo-sum">
          <span className="gw-lo-sum-val">{Math.round(stats.defense * 100)}%</span>
          <span className="gw-lo-sum-key">Mitigation</span>
        </div>
      </div>
    </div>
  );
}
