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

type BootState = "checking" | "ready" | "blocked";

/** Victory / defeat banner shown over the battlefield once the match resolves. */
function MatchEndOverlay() {
  const navigate = useNavigate();
  const phase = useGame((s) => s.phase);
  const score = useGame((s) => s.score);
  const kills = useGame((s) => s.kills);
  const difficulty = useGame((s) => s.difficulty);
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
          type="button"
          className="gw-btn"
          onClick={() => {
            const r = prepareAndStartMatch();
            if (!r.ok) console.error(r.error);
          }}
        >
          WAGE WAR AGAIN
        </button>
        <button
          type="button"
          className="gw-btn gw-btn-ghost"
          onClick={() => {
            useGame.getState().reset();
            navigate("/lobby");
          }}
        >
          RETURN TO WARCAMP
        </button>
      </div>
    </div>
  );
}

function tryBootMatch(): { ok: boolean; error?: string } {
  try {
    const result = prepareAndStartMatch();
    if (result.ok) {
      markDeployDone();
      console.info("[warlord-genesis] /play ready", result);
    }
    return result;
  } catch (err) {
    return { ok: false, error: (err as Error).message || "Battle boot failed" };
  }
}

/**
 * /play — battle surface.
 *
 * Flow:
 *  1. Capability preflight (WebGL required)
 *  2. If already in battle (lobby/deploy started match) → show canvas
 *  3. Else auto-prepare warcamp kit + startGame (deep link /play?skirmish=1)
 *  4. Never infinite-spin: hard failure → gate with retry + warcamp link
 */
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
  const [boot, setBoot] = useState<BootState>("checking");
  const [gateErr, setGateErr] = useState("");
  const [caps, setCaps] = useState<CapabilityReport | null>(null);
  const bootAttempted = useRef(false);

  const quick =
    params.get("skirmish") === "1" ||
    params.get("quick") === "1" ||
    params.get("auto") === "1";

  const capReport = useMemo(() => runCapabilityPreflight(), []);

  useEffect(() => {
    void bootEngine();
  }, []);

  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  // Single boot attempt (not re-run on every phase tick).
  useEffect(() => {
    if (bootAttempted.current) return;
    bootAttempted.current = true;

    setCaps(capReport);
    if (!capReport.ok) {
      setBoot("blocked");
      setGateErr(capReport.blockers.join(" · ") || "Required browser features missing");
      return;
    }

    // Lobby / deploy already started the match.
    if (useGame.getState().phase !== "menu") {
      setBoot("ready");
      setGateErr("");
      return;
    }

    const result = tryBootMatch();
    if (result.ok && useGame.getState().phase !== "menu") {
      setBoot("ready");
      setGateErr("");
      return;
    }

    // One hard retry after a frame (roster hydration race).
    requestAnimationFrame(() => {
      const again = tryBootMatch();
      if (again.ok && useGame.getState().phase !== "menu") {
        setBoot("ready");
        setGateErr("");
      } else {
        setBoot("blocked");
        setGateErr(
          again.error ||
            result.error ||
            "Could not arm warcamp. Open the warcamp and march again.",
        );
      }
    });
  }, [capReport, quick]);

  // If phase becomes battle later (external start), unlock UI.
  useEffect(() => {
    if (phase !== "menu" && boot === "checking") {
      setBoot("ready");
    }
  }, [phase, boot]);

  if (caps && !caps.ok) {
    return (
      <CapabilityGate
        report={caps}
        onRetry={() => {
          const next = runCapabilityPreflight();
          setCaps(next);
          if (next.ok) {
            const result = tryBootMatch();
            setBoot(result.ok ? "ready" : "blocked");
            setGateErr(result.error || "");
          }
        }}
      />
    );
  }

  if (boot === "checking") {
    return (
      <div className="gw-screen gw-play-boot">
        <div className="gw-play-boot-inner">
          <span className="gw-play-boot-spinner" aria-hidden />
          <span className="gw-hint">Arming warcamp · entering the field…</span>
          {caps && (
            <span className="gw-hint" style={{ opacity: 0.65, marginTop: 8, fontSize: 12 }}>
              WebGL {caps.webgl.ok ? "ok" : "fail"} · WebGPU {caps.webgpu ? "available" : "n/a"}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (boot === "blocked" || phase === "menu") {
    return (
      <div className="gw-screen gw-play-gate">
        <div className="gw-play-gate-inner">
          <h2 className="gw-engage-title">Cannot enter battle</h2>
          <p className="gw-hint">
            {gateErr || "Complete warcamp loadout, then march to war."}
          </p>
          <button
            type="button"
            className="gw-btn"
            onClick={() => {
              const result = tryBootMatch();
              if (result.ok && useGame.getState().phase !== "menu") {
                setBoot("ready");
                setGateErr("");
              } else {
                setBoot("blocked");
                setGateErr(result.error || "Still blocked");
              }
            }}
          >
            Retry auto-deploy
          </button>
          <button
            type="button"
            className="gw-btn gw-btn-ghost"
            onClick={() => navigate("/lobby")}
          >
            Open warcamp
          </button>
          <button
            type="button"
            className="gw-btn gw-btn-ghost"
            onClick={() => navigate(DEPLOY_PATH)}
          >
            March orders
          </button>
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
            <span className="gw-engage-sub">Three lanes · one citadel</span>
            <h2 className="gw-engage-title">TAKE THE FIELD</h2>
            <span className="gw-hint">
              Click anywhere to lock the mouse and fight · press ` for warlord command mode · HP{" "}
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
