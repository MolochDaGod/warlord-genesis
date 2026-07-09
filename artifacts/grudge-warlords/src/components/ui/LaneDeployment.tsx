import { useGame } from "../../game/store";
import { useCommand } from "../../game/command";
import { useRoster } from "../../game/roster";
import {
  factionMeleeIds,
  factionRangedIds,
  LANE_LABELS,
  WAVE_BASE_SIZE,
  type LaneId,
  type LanePick,
} from "../../game/laneDeployment";
import { resolveUnitDef } from "../../engine/grudge6";
import { ICONS } from "./icons";

function unitLabel(typeId: string): string {
  const def = resolveUnitDef(typeId);
  if (!def) return typeId.replace(/_/g, " ");
  const line = def.line === "ranged" ? "🏹" : "⚔️";
  return `${line} ${def.name}`;
}

function LaneSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="gw-lane-field">
      <span className="gw-lane-field-label">{label}</span>
      <select
        className="gw-lane-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((id) => (
          <option key={id} value={id}>
            {unitLabel(id)}
          </option>
        ))}
      </select>
    </label>
  );
}

function LaneCard({
  lane,
  pick,
  meleeOpts,
  rangedOpts,
  onPick,
}: {
  lane: LaneId;
  pick: LanePick;
  meleeOpts: string[];
  rangedOpts: string[];
  onPick: (key: keyof LanePick, typeId: string) => void;
}) {
  return (
    <div className="gw-lane-card">
      <div className="gw-lane-card-head">
        <span className="gw-lane-name">{LANE_LABELS[lane]}</span>
        <span className="gw-lane-wave-hint">{WAVE_BASE_SIZE} per wave</span>
      </div>
      <div className="gw-lane-section">
        <span className="gw-lane-section-title">Wave Creep (3M + 2R KayKit mobs)</span>
        <LaneSelect
          label="Melee creep"
          value={pick.meleeCreep}
          options={meleeOpts}
          onChange={(id) => onPick("meleeCreep", id)}
        />
        <LaneSelect
          label="Ranged creep"
          value={pick.rangedCreep}
          options={rangedOpts}
          onChange={(id) => onPick("rangedCreep", id)}
        />
      </div>
    </div>
  );
}

/** RTS lane deployment — wave creep composition; heroes locked from lobby picks. */
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
      <div className="gw-lane-grid">
        {([0, 1, 2] as LaneId[]).map((lane) => (
          <LaneCard
            key={lane}
            lane={lane}
            pick={laneDeployment.lanes[lane]}
            meleeOpts={meleeOpts}
            rangedOpts={rangedOpts}
            onPick={(key, id) => setLanePick(lane, key, id)}
          />
        ))}
      </div>
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