import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Game } from "../components/game/Game";
import { HUD } from "../components/ui/HUD";
import { CapabilityGate } from "../components/ui/CapabilityGate";
import { useGame } from "../game/store";
import { useCommand } from "../game/command";
import { DIFFICULTY } from "../game/config";
import { ICONS } from "../components/ui/icons";
import { bootEngine } from "../engine/boot";
import { useMeta } from "../game/metaProgression";
import { PackOpenOverlay } from "../components/ui/PackOpenOverlay";
import { syncMatchResult } from "../lib/profileSync";
import { DEPLOY_PATH } from "../lib/deployRoutes";
import { prepareAndStartMatch } from "../lib/ensureWarcampReady";
import { markDeployDone } from "./Deploy";
import { EM } from "../game/entities";
import {
  runCapabilityPreflight,
  type CapabilityReport,
} from "../lib/capabilities";
import "../components/ui/collection.css";

/** Victory / defeat banner shown over the battlefield once the match resolves. */
function MatchEndOverlay() {
  const navigate = useNavigate();
  const phase = useGame((s) => s.phase);
  const score = useGame((s) => s.score);
  const kills = useGame((s) => s.kills);
  const difficulty = useGame((s) => s.difficulty);
  const startGame = useGame((s) => s.startGame);
  const grantMatchRewards = useMeta((s) => s.grantMatchRewards);
  const lastMatchReward = useMeta((s) => s.lastMatchReward);
  const rewardedRef = useRef<string | null>(null);

  const won = phase === "victory";
  const diffName = DIFFICULTY[difficulty].name;

  useEffect(() => {
    if (phase !== "victory" && phase !== "defeat") return;
    const key = `${phase}-${score}-${kills}`;
    if (rewardedRef.current === key) return;
    rewardedRef.current = key;
    grantMatchRewards(phase === "victory");
    void syncMatchResult(phase === "victory", score, EM.map?.seed);
  }, [phase, score, kills, grantMatchRewards]);

  if (phase !== "victory" && phase !== "defeat") return null;

  const reward = lastMatchReward;

  return (
    <div className={`gw-screen ${won ? "gw-screen-win" : "gw-screen-over"}`}>
      <div className="gw-screen-inner">
        {won && <img className="gw-trophy" src={ICONS.cup} alt="" draggable={false} />}
        <span className="gw-over-sub">
          {won ? "The Enemy Citadel Lies in Ruin" : "Your Citadel Has Fallen"}
        </span>
        <h1 className={`gw-over-title${won ? " gw-win" : ""}`}>{won ? "VICTORY" : "DEFEAT"}</h1>
        <span className="gw-over-diff">
          {won ? `Conquered on ${diffName}` : `Vanquished on ${diffName}`}
        </span>
        <div className="gw-stats">
          <div className="gw-stat">
            <span className="gw-stat-value">{kills}</span>
            <span className="gw-stat-label">Foes Slain</span>
          </div>
          <div className="gw-stat">
            <span className="gw-stat-value">{score}</span>
            <span className="gw-stat-label">Final Score</span>
          </div>
        </div>
        {reward && (
          <div className="gw-reward-block">
            <span className="gw-reward-gbux">+{reward.gbux} GBUX</span>
            {reward.shardGrants.length > 0 && (
              <div className="gw-reward-shards">
                {reward.shardGrants.map((g, i) => (
                  <span key={`${g.id}-${i}`} className="gw-reward-shard-pill">
                    +1 {g.label}
                  </span>
                ))}
              </div>
            )}
            <span className="gw-over-diff">Collect 10 shards to unlock heroes & lane guards</span>
          </div>
        )}
        <button
          className="gw-btn"
          onClick={() => {
            const ok = startGame();
            if (!ok) {
              const r = prepareAndStartMatch();
              if (!r.ok) console.error(r.error);
            }
          }}
        >
          WAGE WAR AGAIN
        </button>
        <button
          className="gw-btn gw-btn-ghost"
          onClick={() => {
            useGame.getState().reset();
            navigate(DEPLOY_PATH);
          }}
        >
          RETURN TO CAMP
        </button>
      </div>
    </div>
  );
}

export function Play() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const phase = useGame((s) => s.phase);
  const mode = useCommand((s) => s.mode);
  const health = useGame((s) => s.health);
  const maxHealth = useGame((s) => s.maxHealth);
  const damageMult = useGame((s) => s.damageMult);
  const defense = useGame((s) => s.defense);
  const [locked, setLocked] = useState(false);
  const [boot, setBoot] = useState<boolean | null>(null);
  const [gateErr, setGateErr] = useState("");
  const [caps, setCaps] = useState<CapabilityReport | null>(null);
  const autoSkirmish = params.get("skirmish") === "1" || params.get("quick") === "1";

  const capReport = useMemo(() => runCapabilityPreflight(), []);

  useEffect(() => {
    void bootEngine();
  }, []);

  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  useEffect(() => {
    setCaps(capReport);
    if (!capReport.ok) {
      setBoot(false);
      setGateErr(capReport.blockers.join(" · ") || "Required browser features missing");
      return;
    }

    // Already mid-match (hot reload / remount).
    if (phase !== "menu") {
      setBoot(true);
      setGateErr("");
      return;
    }

    try {
      // Always auto-prepare a strong default start so /play is never a naked hero.
      const result = prepareAndStartMatch();
      if (!result.ok) {
        setBoot(false);
        setGateErr(result.error || "Battle boot failed");
        return;
      }
      markDeployDone();
      setBoot(true);
      setGateErr("");
      console.info("[warlord-genesis] /play ready", result);
    } catch (err) {
      setBoot(false);
      setGateErr((err as Error).message || "Battle boot failed");
    }
  }, [phase, capReport, autoSkirmish]);

  if (caps && !caps.ok) {
    return (
      <CapabilityGate
        report={caps}
        onRetry={() => {
          const next = runCapabilityPreflight();
          setCaps(next);
          if (next.ok) {
            const result = prepareAndStartMatch();
            setBoot(result.ok);
            setGateErr(result.error || "");
            if (result.ok) markDeployDone();
          }
        }}
      />
    );
  }

  if (boot === null) {
    return (
      <div className="gw-screen gw-play-boot">
        <div className="gw-play-boot-inner">
          <span className="gw-play-boot-spinner" aria-hidden />
          <span className="gw-hint">Checking systems · arming warcamp kit…</span>
          {caps && (
            <span className="gw-hint" style={{ opacity: 0.65, marginTop: 8, fontSize: 12 }}>
              WebGL {caps.webgl.ok ? "ok" : "fail"} · WebGPU{" "}
              {caps.webgpu ? "available" : "n/a"} · WASM / workers verified
            </span>
          )}
        </div>
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="gw-screen gw-play-gate">
        <div className="gw-play-gate-inner">
          <h2 className="gw-engage-title">Cannot enter battle</h2>
          <p className="gw-hint">{gateErr || "Complete deployment at the warcamp first."}</p>
          <button
            type="button"
            className="gw-btn"
            onClick={() => {
              const result = prepareAndStartMatch();
              if (result.ok) {
                markDeployDone();
                setBoot(true);
                setGateErr("");
              } else {
                setGateErr(result.error || "Still blocked");
              }
            }}
          >
            Retry auto-deploy
          </button>
          <button type="button" className="gw-btn gw-btn-ghost" onClick={() => navigate(DEPLOY_PATH)}>
            Open march orders
          </button>
        </div>
      </div>
    );
  }

  if (phase === "menu") {
    // Should not stick here after prepareAndStartMatch — one more hard attempt.
    return (
      <div className="gw-screen gw-play-boot">
        <div className="gw-play-boot-inner">
          <span className="gw-play-boot-spinner" aria-hidden />
          <span className="gw-hint">Entering the field…</span>
        </div>
      </div>
    );
  }

  const showEngage = phase === "battle" && !locked && mode === "combat";

  return (
    <div className="gw-canvas-wrap">
      <Game />
      <HUD />
      {showEngage && (
        <div id="lock-target" className="gw-engage">
          <div className="gw-engage-inner">
            <span className="gw-engage-sub">The host awaits your command</span>
            <h2 className="gw-engage-title">TAKE THE FIELD</h2>
            <span className="gw-hint">
              Click to lock the mouse · press ` to switch to command · HP{" "}
              {Math.round(health)}/{Math.round(maxHealth)} · ×{damageMult.toFixed(2)} dmg ·{" "}
              {Math.round(defense * 100)}% DR
            </span>
          </div>
        </div>
      )}
      <MatchEndOverlay />
      <PackOpenOverlay />
    </div>
  );
}
