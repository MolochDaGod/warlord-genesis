/**
 * Fleet / march-orders entry — quick lane draft then assault.
 * Canonical warcamp with full roster UI lives at /lobby.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../game/store";
import { useRoster } from "../game/roster";
import { useMeta } from "../game/metaProgression";
import { useSession } from "../game/session";
import { useUI } from "../game/ui";
import { ensureWarcampReady, prepareAndStartMatch } from "../lib/ensureWarcampReady";
import { evaluateWarcampReady } from "../hooks/useWarcampReady";
import { PreMatchLaneDeploy } from "../components/ui/PreMatchLaneDeploy";
import { GRUDGE_FACTION_BY_ID } from "../engine/grudge6";
import { meleeDisplayName, rangedDisplayName } from "../game/canonicalLoadout";
import type { LaneId } from "../game/laneDeployment";
import { ICONS } from "../components/ui/icons";

const DEPLOY_DONE_KEY = "wg-deploy-done";
const CHAMPION_LANE_KEY = "wg-champion-lane";

function readChampionLane(): LaneId {
  try {
    const n = Number(sessionStorage.getItem(CHAMPION_LANE_KEY));
    if (n === 0 || n === 1 || n === 2) return n as LaneId;
  } catch {
    /* ignore */
  }
  return 1;
}

export function Deploy() {
  const navigate = useNavigate();
  const startGame = useGame((s) => s.startGame);
  const lockLoadout = useRoster((s) => s.lockLoadout);
  const factionId = useRoster((s) => s.factionId);
  const prefabId = useRoster((s) => s.prefabId);
  const meleeId = useRoster((s) => s.meleeId);
  const rangedId = useRoster((s) => s.rangedId);
  const user = useSession((s) => s.user);
  const openHub = useUI((s) => s.openHub);
  const gbux = useMeta((s) => s.gbux);
  const [lane, setLane] = useState<LaneId>(readChampionLane);
  const [phase, setPhase] = useState<"load" | "deploy">("load");
  const [loadMsg, setLoadMsg] = useState("Syncing Railway + Grudge API…");

  const faction = GRUDGE_FACTION_BY_ID[factionId];

  useEffect(() => {
    let alive = true;
    (async () => {
      setPhase("load");
      ensureWarcampReady();
      await useSession.getState().restore().catch(() => null);
      if (!alive) return;
      const ready = evaluateWarcampReady();
      setLoadMsg(
        ready.ready
          ? `Hero ready · ${prefabId.replace(/-/g, " ")}`
          : "Session ready — configure your lanes",
      );
      window.setTimeout(() => alive && setPhase("deploy"), 400);
    })();
    return () => {
      alive = false;
    };
  }, [prefabId]);

  const assault = () => {
    ensureWarcampReady();
    if (!evaluateWarcampReady().ready) {
      setLoadMsg("Loadout incomplete — return to warcamp");
      return;
    }
    try {
      sessionStorage.setItem(CHAMPION_LANE_KEY, String(lane));
      sessionStorage.setItem(DEPLOY_DONE_KEY, "1");
    } catch {
      /* ignore */
    }
    lockLoadout();
    const r = prepareAndStartMatch();
    if (!r.ok) {
      const ok = startGame();
      if (!ok) {
        setLoadMsg(r.error || "Cannot start — check warcamp loadout");
        return;
      }
    }
    navigate("/play");
  };

  const heroLabel = useMemo(() => prefabId.replace(/-/g, " "), [prefabId]);

  if (phase === "load") {
    return (
      <div className="gw-screen gw-deploy-screen gw-deploy-loading gk-deploy-shell gk-deploy-v2">
        <div className="gk-deploy-load-wrap">
          <div className="gk-window-panel gk-deploy-load-card">
            <span className="gk-window-head">March Orders</span>
            <div className="gk-window-body">
              <span className="gw-play-boot-spinner" aria-hidden />
              <span className="gw-hint">{loadMsg}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gw-screen gw-deploy-screen gk-deploy-shell gk-deploy-v2">
      <header className="gk-deploy-head">
        <button type="button" className="gw-back" onClick={() => navigate("/lobby")}>
          ‹ WARCAMP
        </button>
        <div className="gk-deploy-head-copy">
          <p className="gk-deploy-kicker">Fleet deploy · Railway account</p>
          <h1 className="gw-deploy-screen-title">Battle Deployment</h1>
          <p className="gw-hint">
            {user ? `${user.displayName ?? user.username} · ` : ""}
            {gbux} GBUX · {faction?.name ?? "Faction"}
          </p>
        </div>
        <div className="gw-menu-actions" style={{ marginLeft: "auto", flexWrap: "wrap", gap: 6 }}>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("account")}>
            <img className="gw-btn-icon" src={ICONS.fist} alt="" draggable={false} />
            {user ? user.displayName || user.username : "ACCOUNT"}
          </button>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("wallet")}>
            <img className="gw-btn-icon" src={ICONS.cup} alt="" draggable={false} />
            WALLET
          </button>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("treaty")}>
            <img className="gw-btn-icon" src={ICONS.chat} alt="" draggable={false} />
            TREATY
          </button>
        </div>
      </header>

      <div className="gk-deploy-main">
        <div className="gw-deploy-summary">
          <div className="gw-deploy-row">
            <span className="gw-deploy-k">Warlord</span>
            <span className="gw-deploy-v">{heroLabel}</span>
          </div>
          <div className="gw-deploy-row">
            <span className="gw-deploy-k">Melee</span>
            <span className="gw-deploy-v">{meleeDisplayName(prefabId, meleeId)}</span>
          </div>
          <div className="gw-deploy-row">
            <span className="gw-deploy-k">Ranged</span>
            <span className="gw-deploy-v">{rangedDisplayName(rangedId)}</span>
          </div>
        </div>

        <div className="gw-mapsize">
          <span className="gw-mapsize-label">Champion lane</span>
          <div className="gw-mapsize-toggle">
            {([0, 1, 2] as LaneId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`gw-btn gw-btn-ghost gw-btn-mini${lane === id ? " gw-active" : ""}`}
                onClick={() => setLane(id)}
              >
                {id === 0 ? "NORTH" : id === 1 ? "MID" : "SOUTH"}
              </button>
            ))}
          </div>
        </div>

        <PreMatchLaneDeploy compact />

        <button type="button" className="gw-btn gw-btn-primary gw-deploy-assault" onClick={assault}>
          BEGIN ASSAULT
        </button>
        <button type="button" className="gw-btn gw-btn-ghost" onClick={() => navigate("/lobby")}>
          Full warcamp
        </button>
      </div>
    </div>
  );
}

export function markDeployDone() {
  try {
    sessionStorage.setItem(DEPLOY_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearDeployDone() {
  try {
    sessionStorage.removeItem(DEPLOY_DONE_KEY);
  } catch {
    /* ignore */
  }
}

export function isDeployDone(): boolean {
  try {
    return sessionStorage.getItem(DEPLOY_DONE_KEY) === "1";
  } catch {
    return false;
  }
}