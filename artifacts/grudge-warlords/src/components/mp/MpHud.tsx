import { useState } from "react";
import { SHOP, STRUCT_DEFS, type UnitKey } from "@workspace/gw-sim";
import { useMp } from "../../net/mpStore";
import { mpSummon } from "../../net/connection";

const LANES = ["West", "Center", "East"];

export function MpHud() {
  const snap = useMp((s) => s.snap);
  const match = useMp((s) => s.match);
  const [lane, setLane] = useState(1);

  if (!match) return null;

  const me = snap?.players.find((p) => p.slot === match.slot) ?? null;
  const credits = me?.credits ?? 0;

  // Core HP for each team, from snapshot structs.
  const coreMax = STRUCT_DEFS.core.hp;
  const allyCore = snap?.structs.find((s) => s.k === "core" && s.t === match.team);
  const enemyCore = snap?.structs.find((s) => s.k === "core" && s.t !== match.team);
  const allyHp = allyCore ? Math.max(0, allyCore.hp / coreMax) : 1;
  const enemyHp = enemyCore ? Math.max(0, enemyCore.hp / coreMax) : 1;

  return (
    <div className="mp-hud">
      <div className="mp-topbar">
        <div className="mp-core">
          <span>YOUR CITADEL</span>
          <div className="mp-bar ally">
            <i style={{ width: `${allyHp * 100}%` }} />
          </div>
        </div>
        <div className="mp-credits">{credits} g</div>
        <div className="mp-core">
          <span>ENEMY CITADEL</span>
          <div className="mp-bar enemy">
            <i style={{ width: `${enemyHp * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="mp-scoreboard pe">
        {snap?.players.map((p) => (
          <div key={p.slot} className={`sb ${p.connected ? "" : "off"}`}>
            <span>
              <span className={`dot t${p.team}`} />
              {p.name}
              {p.slot === match.slot ? " (you)" : ""}
              {p.bot ? " [bot]" : ""}
            </span>
            <span>{p.kills} k</span>
          </div>
        ))}
      </div>

      {me && !me.alive && (
        <div className="mp-respawn">
          <div>You have fallen</div>
          <div className="big">{Math.ceil(me.respawn)}</div>
          <div>respawning at your Citadel</div>
        </div>
      )}

      <div className="mp-shop pe">
        <div className="mp-lane-pick">
          {LANES.map((name, i) => (
            <button
              key={name}
              className={`gw-btn gw-btn-mini ${lane === i ? "" : "gw-btn-ghost"}`}
              onClick={() => setLane(i)}
            >
              {name}
            </button>
          ))}
        </div>
        {SHOP.map((item) => (
          <button
            key={item.unit}
            className="mp-buy"
            disabled={credits < item.cost}
            onClick={() => mpSummon(item.unit as UnitKey, lane)}
          >
            <span>{item.name}</span>
            <span className="cost">{item.cost} g</span>
          </button>
        ))}
      </div>

      <div className="mp-hint">
        Left-click: move · Right-click: attack-move · Summon units down the chosen lane.
      </div>
    </div>
  );
}
