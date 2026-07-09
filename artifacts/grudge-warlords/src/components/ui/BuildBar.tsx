import { useGame } from "../../game/store";
import { useCommand } from "../../game/command";
import { BUILD_HOTKEY_ITEMS, armBuild, repairCitadel } from "../../game/buildActions";
import { WARLORD_MANIFEST } from "../../engine/warlordManifest";
import { ICONS } from "./icons";

const HOTKEYS = ["1", "2", "3", "4", "5"] as const;

/**
 * RTS fortify bar — hotkeys 1–5 arm cannon, ballista, mage tower, barrier, or repair.
 * Visible only in command (warlord) mode.
 */
export function BuildBar() {
  const phase = useGame((s) => s.phase);
  const mode = useCommand((s) => s.mode);
  const credits = useGame((s) => s.credits);
  const allyCoreHp = useGame((s) => s.allyCoreHp);
  const allyCoreMax = useGame((s) => s.allyCoreMax);
  const armed = useCommand((s) => s.build);

  if (phase !== "battle" || mode !== "command") return null;

  return (
    <div className="gw-buildbar">
      <span className="gw-buildbar-title">
        <img className="gw-title-icon" src={ICONS.hammer} alt="" draggable={false} />
        Fortify
      </span>
      <div className="gw-buildbar-slots">
        {BUILD_HOTKEY_ITEMS.map((item, i) => {
          const hotkey = HOTKEYS[i];
          const isRepair = item.kind === "repair";
          const full = isRepair && allyCoreHp >= allyCoreMax;
          const disabled = credits < item.cost || full;
          const isArmed = !isRepair && armed?.ref === item.ref;
          const turret = WARLORD_MANIFEST.turrets.find((t) => t.kind === item.ref);
          const glyph = isRepair ? "🔧" : (turret?.glyph ?? "🏗️");

          return (
            <button
              key={item.id}
              type="button"
              className={`gw-buildbar-slot${isArmed ? " is-armed" : ""}${disabled ? " is-disabled" : ""}`}
              disabled={disabled}
              title={`${item.description} (${hotkey})`}
              onClick={() => {
                if (isRepair) repairCitadel();
                else if (isArmed) useCommand.getState().setBuild(null);
                else armBuild(item.ref);
              }}
            >
              <span className="gw-buildbar-key">{hotkey}</span>
              <span className="gw-buildbar-glyph">{glyph}</span>
              <span className="gw-buildbar-name">{item.name}</span>
              <span className={`gw-buildbar-cost${!full && credits < item.cost ? " gw-cost-cant" : ""}`}>
                {item.cost}
              </span>
            </button>
          );
        })}
      </div>
      <span className="gw-buildbar-hint">1–5 place · Shift+1–5 groups · Ctrl+1–5 recall</span>
    </div>
  );
}

