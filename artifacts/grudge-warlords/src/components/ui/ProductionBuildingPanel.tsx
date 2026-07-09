import { useState } from "react";
import { useGame } from "../../game/store";
import { BUILDINGS, MAX_BUILDING_LEVEL } from "../../game/config";
import {
  MAGE_SPECS,
  RANGER_SPECS,
  WARRIOR_SPECS,
  WORGE_SPECS,
  type MageSpec,
  type ProductionSpecs,
  type RangerSpec,
  type WarriorSpec,
  type WorgeSpec,
} from "../../game/productionSpecs";
import { useCommand } from "../../game/command";
import { ICONS } from "./icons";

type BuildingTab = "barracks" | "archery";

function SpecRow<K extends keyof ProductionSpecs>({
  line,
  label,
  current,
  options,
  credits,
}: {
  line: K;
  label: string;
  current: ProductionSpecs[K];
  options: { id: ProductionSpecs[K]; label: string; blurb: string; cost: number }[];
  credits: number;
}) {
  const upgrade = useGame((s) => s.upgradeProductionSpec);

  if (current !== "base") {
    const active = options.find((o) => o.id === current);
    return (
      <div className="gw-prod-spec gw-prod-spec-locked" title={active?.blurb}>
        <span className="gw-prod-spec-name">{label}</span>
        <span className="gw-prod-spec-val">{active?.label ?? String(current)}</span>
      </div>
    );
  }

  return (
    <div className="gw-prod-spec-group">
      <span className="gw-prod-spec-head">{label}</span>
      <div className="gw-prod-spec-options">
        {options.map((opt) => (
          <button
            key={String(opt.id)}
            type="button"
            className="gw-prod-spec-btn"
            disabled={credits < opt.cost}
            title={opt.blurb}
            onClick={() => upgrade(line, opt.id as WarriorSpec & WorgeSpec & MageSpec & RangerSpec)}
          >
            <span className="gw-prod-spec-btn-name">{opt.label}</span>
            <span className={`gw-prod-spec-btn-cost${credits < opt.cost ? " gw-cost-cant" : ""}`}>
              {opt.cost}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TierCard({ kind }: { kind: BuildingTab }) {
  const credits = useGame((s) => s.credits);
  const lvl = useGame((s) => s.buildings[kind]);
  const upgradeBuilding = useGame((s) => s.upgradeBuilding);
  const def = BUILDINGS[kind];
  const tier = def.levels[lvl - 1];
  const maxed = lvl >= MAX_BUILDING_LEVEL;
  const cost = maxed ? 0 : def.levels[lvl - 1].upgradeCost ?? 0;
  const spawnLabel = kind === "barracks" ? "Warrior + Worge" : "Ranger + Mage";

  return (
    <div className="gw-prod-tier">
      <div className="gw-prod-tier-head">
        <span className="gw-prod-tier-name">{def.name}</span>
        <span className="gw-prod-tier-lvl">Tier {lvl}/{MAX_BUILDING_LEVEL}</span>
      </div>
      <p className="gw-prod-tier-blurb">
        Spawns {spawnLabel} every {tier.interval}s · {tier.count} units · ×{tier.statMult.toFixed(2)} stats
      </p>
      <button
        type="button"
        className="gw-prod-upgrade-btn"
        disabled={maxed || credits < cost}
        title={
          maxed
            ? `${def.name} at maximum tier`
            : `Upgrade to tier ${lvl + 1} — stronger ${spawnLabel} waves`
        }
        onClick={() => upgradeBuilding(kind)}
      >
        <span>{maxed ? "Maximum Tier" : `Upgrade L${lvl} → L${lvl + 1}`}</span>
        <span className={`gw-prod-upgrade-cost${!maxed && credits < cost ? " gw-cost-cant" : ""}`}>
          {maxed ? "MAX" : cost}
        </span>
      </button>
    </div>
  );
}

/**
 * Dedicated barracks & archery interaction panel (command mode).
 * Tier upgrades + one-time specialization picks per production line.
 */
export function ProductionBuildingPanel() {
  const phase = useGame((s) => s.phase);
  const mode = useCommand((s) => s.mode);
  const credits = useGame((s) => s.credits);
  const productionSpecs = useGame((s) => s.productionSpecs);
  const [tab, setTab] = useState<BuildingTab>("barracks");
  const [collapsed, setCollapsed] = useState(false);

  if (phase !== "battle" || mode !== "command") return null;

  return (
    <div className={`gw-prod-panel${collapsed ? " gw-prod-panel-collapsed" : ""}`}>
      <div className="gw-prod-panel-head">
        <img className="gw-title-icon" src={ICONS.hammer} alt="" draggable={false} />
        <span className="gw-prod-panel-title">Production</span>
        <div className="gw-prod-tabs">
          <button
            type="button"
            className={tab === "barracks" ? "active" : ""}
            onClick={() => setTab("barracks")}
          >
            Barracks
          </button>
          <button
            type="button"
            className={tab === "archery" ? "active" : ""}
            onClick={() => setTab("archery")}
          >
            Archery
          </button>
        </div>
        <button
          type="button"
          className="gw-prod-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand production panel" : "Collapse production panel"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed && (
        <div className="gw-prod-panel-body">
          <TierCard kind={tab} />
          {tab === "barracks" ? (
            <>
              <SpecRow
                line="warrior"
                label="Warrior line"
                current={productionSpecs.warrior}
                options={(["paladin", "berserker", "knight"] as const).map((id) => ({
                  id,
                  ...WARRIOR_SPECS[id],
                }))}
                credits={credits}
              />
              <SpecRow
                line="worge"
                label="Worge line"
                current={productionSpecs.worge}
                options={(["pig", "goat", "bear"] as const).map((id) => ({ id, ...WORGE_SPECS[id] }))}
                credits={credits}
              />
            </>
          ) : (
            <>
              <SpecRow
                line="mage"
                label="Mage line"
                current={productionSpecs.mage}
                options={(["healer", "damage", "frost"] as const).map((id) => ({ id, ...MAGE_SPECS[id] }))}
                credits={credits}
              />
              <SpecRow
                line="ranger"
                label="Ranger line"
                current={productionSpecs.ranger}
                options={(["range", "speed", "powerShot"] as const).map((id) => ({
                  id,
                  ...RANGER_SPECS[id],
                }))}
                credits={credits}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}