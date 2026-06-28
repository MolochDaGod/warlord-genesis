import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Game } from "../components/game/Game";
import { HUD } from "../components/ui/HUD";
import { useGame } from "../game/store";
import { useCommand } from "../game/command";
import { DIFFICULTY } from "../game/config";
import { ICONS } from "../components/ui/icons";

/** Victory / defeat banner shown over the battlefield once the match resolves. */
function MatchEndOverlay() {
  const navigate = useNavigate();
  const phase = useGame((s) => s.phase);
  const score = useGame((s) => s.score);
  const kills = useGame((s) => s.kills);
  const difficulty = useGame((s) => s.difficulty);
  const startGame = useGame((s) => s.startGame);

  if (phase !== "victory" && phase !== "defeat") return null;
  const won = phase === "victory";
  const diffName = DIFFICULTY[difficulty].name;

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
        <button className="gw-btn" onClick={() => startGame()}>
          WAGE WAR AGAIN
        </button>
        <button
          className="gw-btn gw-btn-ghost"
          onClick={() => {
            useGame.getState().reset();
            navigate("/lobby");
          }}
        >
          RETURN TO CAMP
        </button>
      </div>
    </div>
  );
}

export function Play() {
  const phase = useGame((s) => s.phase);
  const mode = useCommand((s) => s.mode);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  // Reached without a match in progress (e.g. direct reload) -> back to the camp.
  if (phase === "menu") return <Navigate to="/lobby" replace />;

  // The engage prompt is the pointer-lock target (#lock-target). It only shows
  // when combat is expected but the mouse is not yet captured.
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
            <span className="gw-hint">Click to lock the mouse · press ` to switch to command</span>
          </div>
        </div>
      )}
      <MatchEndOverlay />
    </div>
  );
}
