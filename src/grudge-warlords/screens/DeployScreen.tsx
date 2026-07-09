/**
 * Pre-match MOBA draft — mirrors WgDeployScreen v2 (bundle patch).
 * Lane picks + champion path happen here only; cgA is disabled in battle.
 */
import type { LaneDeployment, LaneId } from "../types";

export type DeployScreenProps = {
  deployment: LaneDeployment;
  championLane: LaneId;
  factionName?: string;
  heroName?: string;
  heroTitle?: string;
  onChampionLane: (lane: LaneId) => void;
  onLanePick: (lane: LaneId, slot: "melee" | "ranged", creepId: string) => void;
  onResetLanes: () => void;
  onBeginAssault: () => void;
  onBack: () => void;
  loadMessage?: string;
  loadWarning?: string;
  phase?: "load" | "deploy";
};

const LANE_LABELS = ["North", "Mid", "South"] as const;
const LANE_HINTS = [
  "Top flank · pressure north",
  "Center push · main breach",
  "Bot sweep · split defense",
] as const;
const LANE_ICONS = [
  "/assets/icons/vox/flaming-spear.png",
  "/assets/icons/vox/golden-arrow.png",
  "/assets/icons/vox/spectral-dagger.png",
] as const;

export function DeployScreen({
  deployment,
  championLane,
  factionName = "Faction",
  heroName = "Warlord",
  heroTitle = "Champion",
  onChampionLane,
  onLanePick,
  onResetLanes,
  onBeginAssault,
  onBack,
  loadMessage = "Syncing Railway + Grudge API…",
  loadWarning,
  phase = "deploy",
}: DeployScreenProps) {
  if (phase === "load") {
    return (
      <div className="gw-screen gw-deploy-screen gw-deploy-loading gk-root gk-deploy-shell gk-deploy-v2">
        <div className="gk-deploy-load-wrap">
          <div className="gk-window-panel gk-deploy-load-card">
            <span className="gk-window-head">March Orders</span>
            <div className="gk-window-body">
              <span className="gw-play-boot-spinner" aria-hidden />
              <span className="gw-hint">{loadMessage}</span>
              {loadWarning && <p className="gw-deploy-load-warn">{loadWarning}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lanePick = deployment.lanes[championLane];

  return (
    <div className="gw-screen gw-deploy-screen gk-root gk-deploy-shell gk-deploy-v2">
      <div className="gk-deploy-layout">
        <aside className="gk-quest-rail" aria-label="March orders" />
        <div className="gk-deploy-main">
          <header className="gk-deploy-head">
            <button type="button" className="gw-back" onClick={onBack}>
              ‹ WARCAMP
            </button>
            <div className="gk-deploy-head-copy">
              <p className="gk-deploy-kicker">Pre-battle draft</p>
              <h1 className="gw-deploy-screen-title">Battle Deployment</h1>
              <p className="gw-deploy-screen-lead">
                Set champion lane and auto-wave creeps. Breach a lane, then raze the enemy citadel.
              </p>
            </div>
            <div className="gk-deploy-chips">
              <span className="gk-deploy-chip is-ok">Engine ready</span>
              <span className="gk-deploy-chip">{factionName}</span>
            </div>
          </header>

          <section className="gk-deploy-hero-strip">
            <img
              className="gk-deploy-hero-icon"
              src="/assets/icons/brand/bosslogo.png"
              alt=""
              draggable={false}
            />
            <div className="gk-deploy-hero-copy">
              <span className="gk-deploy-hero-name">{heroName}</span>
              <span className="gk-deploy-hero-meta">
                {heroTitle} · Lane {LANE_LABELS[championLane]}
              </span>
            </div>
            <div className="gk-deploy-hero-stats">
              <span>Melee {lanePick.meleeCreep}</span>
              <span>Ranged {lanePick.rangedCreep}</span>
            </div>
          </section>

          <div className="gk-deploy-grid">
            <section className="gk-window-panel gk-deploy-window gk-deploy-path">
              <span className="gk-window-head">Champion Path</span>
              <div className="gk-window-body">
                <p className="gw-deploy-champion-hint">
                  Your GRUDGE6 warlord spawns on this lane when the assault begins.
                </p>
                <div className="gk-lane-path-grid">
                  {([0, 1, 2] as LaneId[]).map((lane) => (
                    <button
                      key={lane}
                      type="button"
                      className={`gk-lane-path-tile${championLane === lane ? " is-active" : ""}`}
                      onClick={() => onChampionLane(lane)}
                    >
                      <img
                        className="gk-lane-path-icon"
                        src={LANE_ICONS[lane]}
                        alt=""
                        draggable={false}
                      />
                      <span className="gk-lane-path-name">{LANE_LABELS[lane]}</span>
                      <span className="gk-lane-path-hint">{LANE_HINTS[lane]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="gk-window-panel gk-deploy-window gk-deploy-lanes">
              <span className="gk-window-head">Lane Wave Deployment</span>
              <div className="gk-window-body">
                <p className="gk-deploy-lanes-lead">
                  Each lane spawns 2 melee + 1 ranged KayKit creeps per wave. Tune composition before you march.
                </p>
                <div className="gw-lane-grid gk-lane-grid">
                  {([0, 1, 2] as LaneId[]).map((lane) => (
                    <LanePickCard
                      key={lane}
                      lane={lane}
                      label={LANE_LABELS[lane]}
                      pick={deployment.lanes[lane]}
                      onPick={(slot, id) => onLanePick(lane, slot, id)}
                    />
                  ))}
                </div>
              </div>
            </section>
          </div>

          <footer className="gk-deploy-footer">
            <button type="button" className="gw-btn gw-btn-ghost" onClick={onResetLanes}>
              Optimal Deploy
            </button>
            <button
              type="button"
              className="gw-btn gw-deploy-assault gk-deploy-assault"
              onClick={onBeginAssault}
            >
              Begin Assault
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

type LanePickCardProps = {
  lane: LaneId;
  label: string;
  pick: LaneDeployment["lanes"][LaneId];
  onPick: (slot: "melee" | "ranged", creepId: string) => void;
};

function LanePickCard({ label, pick }: LanePickCardProps) {
  return (
    <div className="gw-lane-card gk-lane-card" data-lane={label}>
      <div className="gw-lane-card-head">
        <span className="gw-lane-name">{label}</span>
      </div>
      <div className="gw-lane-section">
        <span className="gw-lane-section-title">Wave Creep (2M + 1R KayKit mobs)</span>
        <span className="gw-lane-card-effect">Melee: {pick.meleeCreep}</span>
        <span className="gw-lane-card-effect">Ranged: {pick.rangedCreep}</span>
      </div>
    </div>
  );
}