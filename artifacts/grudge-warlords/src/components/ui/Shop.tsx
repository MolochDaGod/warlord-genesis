import { useGame } from "../../game/store";
import { useCommand } from "../../game/command";
import { EM } from "../../game/entities";
import {
  SHOP_UNITS,
  SHOP_BUILDS,
  REPAIR_AMOUNT,
  BUILDINGS,
  MAX_BUILDING_LEVEL,
  ALLY_TECH,
  MAX_ALLY_TECH,
  type ShopItem,
} from "../../game/config";
import { ICONS } from "./icons";

function buyUnit(item: ShopItem) {
  const g = useGame.getState();
  if (g.credits < item.cost) {
    g.pushMessage("NOT ENOUGH CREDITS", "warn");
    return;
  }
  g.spendCredits(item.cost);
  const rally = EM.map.rally;
  const x = rally.x + (Math.random() - 0.5) * 10;
  const z = rally.z + (Math.random() - 0.5) * 3;
  const u = EM.spawnUnit("ally", item.ref, x, z, { commandable: true });
  u.order = "idle";
  g.pushMessage(`${item.name.toUpperCase()} JOINS THE WARBAND`, "good");
}

function armOrRepair(item: ShopItem) {
  const g = useGame.getState();
  const cmd = useCommand.getState();
  if (item.kind === "repair") {
    if (g.allyCoreHp >= g.allyCoreMax) {
      g.pushMessage("CITADEL ALREADY AT FULL STRENGTH", "warn");
      return;
    }
    if (g.credits < item.cost) {
      g.pushMessage("NOT ENOUGH CREDITS", "warn");
      return;
    }
    g.spendCredits(item.cost);
    g.repairAllyCore(REPAIR_AMOUNT);
    g.pushMessage("THE CITADEL IS MENDED", "good");
    return;
  }
  // Arm a ghost build; force command mode so the player can place it.
  cmd.setMode("command");
  cmd.setBuild({ ref: item.ref, cost: item.cost });
  g.pushMessage("CHOOSE WHERE TO RAISE IT", "info");
}

export function Shop() {
  const phase = useGame((s) => s.phase);
  const credits = useGame((s) => s.credits);
  const allyCoreHp = useGame((s) => s.allyCoreHp);
  const allyCoreMax = useGame((s) => s.allyCoreMax);
  const buildings = useGame((s) => s.buildings);
  const allyTech = useGame((s) => s.allyTech);
  const armed = useCommand((s) => s.build);

  if (phase !== "battle") return null;

  const techMaxed = allyTech >= MAX_ALLY_TECH;
  const nextTech = techMaxed ? null : ALLY_TECH[allyTech];

  return (
    <div className="gw-shop">
      <div className="gw-shop-group">
        <span className="gw-shop-title"><img className="gw-title-icon" src={ICONS.fist} alt="" draggable={false} />Warband</span>
        {SHOP_UNITS.map((item) => (
          <button
            key={item.id}
            className="gw-shop-item"
            disabled={credits < item.cost}
            title={item.description}
            onClick={() => buyUnit(item)}
          >
            <span className="gw-shop-name">{item.name}</span>
            <span className={`gw-shop-cost${credits < item.cost ? " gw-cost-cant" : ""}`}>{item.cost}</span>
          </button>
        ))}
      </div>

      <div className="gw-shop-group">
        <span className="gw-shop-title"><img className="gw-title-icon" src={ICONS.hammer} alt="" draggable={false} />Fortify</span>
        {SHOP_BUILDS.map((item) => {
          const isRepair = item.kind === "repair";
          const full = isRepair && allyCoreHp >= allyCoreMax;
          const disabled = credits < item.cost || full;
          const isArmed = !isRepair && armed?.ref === item.ref;
          const towerGlyph =
            item.ref === "cannon" ? "💣" :
            item.ref === "ballista" ? "🏹" :
            item.ref === "mage" ? "🔮" :
            item.ref === "barrier" ? "🧱" : "🔧";
          return (
            <button
              key={item.id}
              className={`gw-shop-item${isArmed ? " gw-armed" : ""}`}
              disabled={disabled}
              title={item.description}
              onClick={() => armOrRepair(item)}
            >
              <span className="gw-shop-name">{towerGlyph} {item.name}</span>
              <span className={`gw-shop-cost${!full && credits < item.cost ? " gw-cost-cant" : ""}`}>{item.cost}</span>
            </button>
          );
        })}
      </div>

      <div className="gw-shop-group">
        <span className="gw-shop-title"><img className="gw-title-icon" src={ICONS.fist} alt="" draggable={false} />Production</span>
        {(["barracks", "archery"] as const).map((kind) => {
          const lvl = buildings[kind];
          const maxed = lvl >= MAX_BUILDING_LEVEL;
          const cost = maxed ? 0 : BUILDINGS[kind].levels[lvl - 1].upgradeCost ?? 0;
          return (
            <button
              key={kind}
              className="gw-shop-item"
              disabled={maxed || credits < cost}
              title={
                maxed
                  ? `${BUILDINGS[kind].name} at maximum tier`
                  : `Upgrade ${BUILDINGS[kind].name} to tier ${lvl + 1} — stronger, faster reinforcements`
              }
              onClick={() => useGame.getState().upgradeBuilding(kind)}
            >
              <span className="gw-shop-name">
                {BUILDINGS[kind].name} {maxed ? "(Max)" : `L${lvl}\u2192${lvl + 1}`}
              </span>
              <span className={`gw-shop-cost${!maxed && credits < cost ? " gw-cost-cant" : ""}`}>{maxed ? "MAX" : cost}</span>
            </button>
          );
        })}
      </div>

      <div className="gw-shop-group">
        <span className="gw-shop-title"><img className="gw-title-icon" src={ICONS.fist} alt="" draggable={false} />Empower</span>
        <button
          className="gw-shop-item"
          disabled={techMaxed || !nextTech || credits < nextTech.cost}
          title={
            nextTech
              ? `${nextTech.name} — ${nextTech.description}`
              : "Your army is fully empowered"
          }
          onClick={() => useGame.getState().upgradeTech()}
        >
          <span className="gw-shop-name">
            {nextTech ? `${nextTech.name} (T${allyTech + 1})` : `Army (Max T${allyTech})`}
          </span>
          <span className={`gw-shop-cost${nextTech && credits < nextTech.cost ? " gw-cost-cant" : ""}`}>{nextTech ? nextTech.cost : "MAX"}</span>
        </button>
      </div>
    </div>
  );
}
