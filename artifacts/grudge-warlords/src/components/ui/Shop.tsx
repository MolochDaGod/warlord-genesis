import { useGame } from "../../game/store";
import { useCommand } from "../../game/command";
import { EM } from "../../game/entities";
import {
  SHOP_UNITS,
  ALLY_TECH,
  MAX_ALLY_TECH,
  UNIT_TYPES,
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

export function Shop() {
  const phase = useGame((s) => s.phase);
  const credits = useGame((s) => s.credits);
  const allyTech = useGame((s) => s.allyTech);
  const mode = useCommand((s) => s.mode);

  if (phase !== "battle" || mode !== "command") return null;

  const techMaxed = allyTech >= MAX_ALLY_TECH;
  const nextTech = techMaxed ? null : ALLY_TECH[allyTech];

  return (
    <div className="gw-shop">
      <div className="gw-shop-group">
        <span className="gw-shop-title"><img className="gw-title-icon" src={ICONS.fist} alt="" draggable={false} />Warband</span>
        {SHOP_UNITS.map((item) => {
          const unitGlyph =
            item.ref === "footman" ? "🗡️" :
            item.ref === "archer" ? "🏹" :
            item.ref === "knight" ? "🛡️" : "⚔️";
          const udef = UNIT_TYPES[item.ref];
          const tierTag = udef?.tier ? `T${udef.tier}` : "";
          return (
          <button
            key={item.id}
            className="gw-shop-item"
            disabled={credits < item.cost}
            title={item.description}
            onClick={() => buyUnit(item)}
          >
            <span className="gw-shop-name">{unitGlyph} {item.name}{tierTag ? ` · ${tierTag}` : ""}</span>
            <span className={`gw-shop-cost${credits < item.cost ? " gw-cost-cant" : ""}`}>{item.cost}</span>
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
