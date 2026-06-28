import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMp } from "../../net/mpStore";
import { useSession } from "../../game/session";
import { connect, disconnect, mpLeaveRoom } from "../../net/connection";
import { MpLobby } from "./MpLobby";
import { MatchPvP } from "./MatchPvP";
import { MpHud } from "./MpHud";
import "./mp.css";

function ResultScreen({ onBack }: { onBack: () => void }) {
  const result = useMp((s) => s.result);
  const match = useMp((s) => s.match);
  const won = result != null && match != null && result === match.team;
  return (
    <div className="mp-result">
      <h1 className={won ? "win" : "lose"}>{won ? "VICTORY" : "DEFEAT"}</h1>
      <p className="mp-sub">
        {won ? "The enemy Citadel lies in ruins." : "Your Citadel has fallen."}
      </p>
      <button className="gw-btn" style={{ marginTop: 18 }} onClick={onBack}>
        BACK TO LOBBY
      </button>
    </div>
  );
}

export function MultiplayerPage() {
  const navigate = useNavigate();
  const view = useMp((s) => s.view);
  const match = useMp((s) => s.match);
  const user = useSession((s) => s.user);

  useEffect(() => {
    const name = user?.displayName || user?.username || undefined;
    connect(name);
    return () => disconnect();
    // Reconnect only when identity changes.
  }, [user?.displayName, user?.username]);

  if (view === "match" && match) {
    return (
      <div className="gw-screen" style={{ inset: 0, padding: 0 }}>
        <MatchPvP match={match} />
        <MpHud />
      </div>
    );
  }

  if (view === "result") {
    return (
      <div className="gw-screen" style={{ inset: 0, padding: 0 }}>
        {match && <MatchPvP match={match} />}
        <ResultScreen onBack={() => mpLeaveRoom()} />
      </div>
    );
  }

  return <MpLobby onExit={() => navigate("/")} />;
}
