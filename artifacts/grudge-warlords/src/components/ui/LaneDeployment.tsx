import { useGame } from "../../game/store";
import { useCommand } from "../../game/command";
import { useRoster } from "../../game/roster";
import {
  factionMeleeIds,
  factionRangedIds,
  type LanePick,
} from "../../game/laneDeployment";
import { LaneWaveGrid, unitLabel } from "./LaneWaveCards";
import { ICONS } from "./icons";

/** In-match lane deployment — wave creep composition; heroes locked from lobby picks. */
export function LaneDeployment() {
  const phase = useGame((s) => s.phase);
  const mode = useCommand((s) => s.mode);
  const factionId = useRoster((s) => s.factionId);
  const laneMeleeHeroId = useRoster((s) => s.laneMeleeHeroId);
  const laneRangedHeroId = useRoster((s) => s.laneRangedHeroId);
  const allyTech = useGame((s) => s.allyTech);
  const deploymentRound = useGame((s) => s.deploymentRound);
  const deploymentHighlight = useGame((s) => s.deploymentHighlight);
  const laneDeployment = useGame((s) => s.laneDeployment);
  const setLanePick = useGame((s) => s.setLanePick);
  const resetLaneDeployment = useGame((s) => s.resetLaneDeployment);
  const dismissDeploymentHighlight = useGame((s) => s.dismissDeploymentHighlight);

  if (phase !== "battle" || mode !== "command") return null;

  const meleeOpts = factionMeleeIds(factionId);
  const rangedOpts = factionRangedIds(factionId);

  return (
    <div className={`gw-lane-deploy${deploymentHighlight ? " gw-lane-deploy-pulse" : ""}`}>
      <div className="gw-lane-deploy-head">
        <span className="gw-lane-deploy-title">
          <img className="gw-title-icon" src={ICONS.tune} alt="" draggable={false} />
          Lane Deployment
        </span>
        <span className="gw-lane-deploy-round">Round {deploymentRound}</span>
        {allyTech > 0 && <span className="gw-lane-tech-tag">Army T{allyTech}</span>}
      </div>
      <p className="gw-lane-deploy-blurb">
        Lane guards: {unitLabel(laneMeleeHeroId)} + {unitLabel(laneRangedHeroId)} (GRUDGE6 heroes
        from lobby). Auto waves spawn 3 melee + 2 ranged KayKit faction mobs on every lane.
      </p>
      <LaneWaveGrid
        lanes={laneDeployment.lanes}
        meleeOpts={meleeOpts}
        rangedOpts={rangedOpts}
        onPick={(lane, key, id) => setLanePick(lane, key as keyof LanePick, id)}
      />
      <div className="gw-lane-deploy-actions">
        <button type="button" className="gw-lane-btn" onClick={() => resetLaneDeployment()}>
          Reset defaults
        </button>
        {deploymentHighlight && (
          <button type="button" className="gw-lane-btn gw-lane-btn-primary" onClick={() => dismissDeploymentHighlight()}>
            Confirm round {deploymentRound}
          </button>
        )}
      </div>
    </div>
  );
}