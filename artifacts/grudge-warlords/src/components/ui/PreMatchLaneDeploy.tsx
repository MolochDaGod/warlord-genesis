import { useMemo } from "react";
import { useGame } from "../../game/store";
import { useRoster } from "../../game/roster";
import { factionMeleeIds, factionRangedIds } from "../../game/laneDeployment";
import { LaneWaveGrid, unitLabel } from "./LaneWaveCards";

/** Pre-match lane wave troop picks — shown on /deploy before MARCH TO WAR. */
export function PreMatchLaneDeploy({ compact }: { compact?: boolean }) {
  const factionId = useRoster((s) => s.factionId);
  const laneMeleeHeroId = useRoster((s) => s.laneMeleeHeroId);
  const laneRangedHeroId = useRoster((s) => s.laneRangedHeroId);
  const laneDeployment = useGame((s) => s.laneDeployment);
  const setLanePick = useGame((s) => s.setLanePick);
  const resetLaneDeployment = useGame((s) => s.resetLaneDeployment);

  const meleeOpts = useMemo(() => factionMeleeIds(factionId), [factionId]);
  const rangedOpts = useMemo(() => factionRangedIds(factionId), [factionId]);

  return (
    <section
      id="lane-wave-troops"
      className={`gw-prematch-lane${compact ? " gw-prematch-lane--compact" : ""}`}
    >
      <div className="gw-prematch-lane-head">
        <span className="gw-cs-label">LANE WAVE TROOPS</span>
        {!compact && (
          <button type="button" className="gw-lane-btn" onClick={() => resetLaneDeployment()}>
            Reset defaults
          </button>
        )}
      </div>
      <p className="gw-cs-lane-hint">
        Each lane auto-spawns <strong>3 melee + 2 ranged</strong> KayKit creeps every wave. Guards{" "}
        {unitLabel(laneMeleeHeroId)} + {unitLabel(laneRangedHeroId)} march all lanes.
      </p>
      <LaneWaveGrid
        lanes={laneDeployment.lanes}
        meleeOpts={meleeOpts}
        rangedOpts={rangedOpts}
        onPick={(lane, key, id) => setLanePick(lane, key, id)}
        stack={compact}
      />
      {compact && (
        <button type="button" className="gw-lane-btn gw-lane-btn-block" onClick={() => resetLaneDeployment()}>
          Reset lane defaults
        </button>
      )}
    </section>
  );
}