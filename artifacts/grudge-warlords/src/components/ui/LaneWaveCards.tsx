import { resolveUnitDef } from "../../engine/grudge6";
import {
  LANE_LABELS,
  WAVE_BASE_SIZE,
  type LaneId,
  type LanePick,
} from "../../game/laneDeployment";

export function unitLabel(typeId: string): string {
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

export function LaneWaveCard({
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
        <span className="gw-lane-section-title">Wave troops (3 melee + 2 ranged)</span>
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

export function LaneWaveGrid({
  lanes,
  meleeOpts,
  rangedOpts,
  onPick,
  stack,
}: {
  lanes: Record<LaneId, LanePick>;
  meleeOpts: string[];
  rangedOpts: string[];
  onPick: (lane: LaneId, key: keyof LanePick, typeId: string) => void;
  stack?: boolean;
}) {
  return (
    <div className={`gw-lane-grid${stack ? " gw-lane-grid--stack" : ""}`}>
      {([0, 1, 2] as LaneId[]).map((lane) => (
        <LaneWaveCard
          key={lane}
          lane={lane}
          pick={lanes[lane]}
          meleeOpts={meleeOpts}
          rangedOpts={rangedOpts}
          onPick={(key, id) => onPick(lane, key, id)}
        />
      ))}
    </div>
  );
}