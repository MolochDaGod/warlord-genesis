import { useMp } from "../../net/mpStore";
import { useUI } from "../../game/ui";
import { useSession } from "../../game/session";
import {
  mpCancelQuickplay,
  mpCreateRoom,
  mpJoinRoom,
  mpLeaveRoom,
  mpQuickplay,
  mpReady,
  mpRefreshRooms,
  mpStartRoom,
} from "../../net/connection";

function StatusPill() {
  const status = useMp((s) => s.status);
  const label = status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Offline";
  const cls = status === "connected" ? "ok" : status === "disconnected" ? "bad" : "";
  return <span className={`mp-status ${cls}`}>● {label}</span>;
}

export function MpLobby({ onExit }: { onExit: () => void }) {
  const view = useMp((s) => s.view);
  const rooms = useMp((s) => s.rooms);
  const room = useMp((s) => s.room);
  const queue = useMp((s) => s.queue);
  const me = useMp((s) => s.me);
  const error = useMp((s) => s.error);
  const openHub = useUI((s) => s.openHub);
  const user = useSession((s) => s.user);

  if (view === "queued" && queue) {
    return (
      <div className="mp-screen">
        <div className="mp-panel" style={{ textAlign: "center" }}>
          <h2 className="mp-title">Searching for a Match</h2>
          <p className="mp-sub">
            {queue.mode} · {queue.size}/{queue.need} warlords gathered…
          </p>
          <div className="mp-actions" style={{ justifyContent: "center" }}>
            <button className="gw-btn" onClick={mpCancelQuickplay}>
              CANCEL
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "room" && room) {
    const amHost = me?.id === room.hostId;
    const myInfo = room.players.find((p) => p.id === me?.id);
    return (
      <div className="mp-screen">
        <div className="mp-panel">
          <h2 className="mp-title">War Room · {room.id}</h2>
          <p className="mp-sub">
            {room.mode} · {room.players.length}/{room.capacity} seated. Empty seats are filled by bots
            when the match begins.
          </p>
          <ul className="mp-seat-list">
            {room.players.map((p) => (
              <li key={p.id} className={`mp-seat t${p.team}`}>
                <span>
                  {p.name}
                  {p.id === me?.id ? " (you)" : ""}
                </span>
                <span className="mp-tag">
                  Team {p.team === 0 ? "A" : "B"}
                  {p.host ? " · host" : ""}
                  {p.ready ? " · ready" : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="mp-actions">
            <button className="gw-btn" onClick={() => mpReady(!myInfo?.ready)}>
              {myInfo?.ready ? "UNREADY" : "READY"}
            </button>
            {amHost && (
              <button className="gw-btn gw-btn-strong" onClick={mpStartRoom}>
                START MATCH
              </button>
            )}
            <button className="gw-btn gw-btn-ghost" onClick={mpLeaveRoom}>
              LEAVE
            </button>
          </div>
          {error && <p className="mp-error">{error}</p>}
        </div>
      </div>
    );
  }

  // Default: lobby browser
  return (
    <div className="mp-screen">
      <div className="mp-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 className="mp-title">Online War</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <StatusPill />
            <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("account")}>
              {user ? user.displayName || user.username : "ACCOUNT"}
            </button>
            <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("wallet")}>
              WALLET
            </button>
            <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("treaty")}>
              TREATY
            </button>
          </div>
        </div>
        <p className="mp-sub">
          Same Grudge ID across fleet · Railway account SSOT. Quick match into 1v1, 2v2, or 3v3, or open a
          private war room. If the match server is offline, rooms run locally and bots fill empty seats.
        </p>

        <div className="mp-grid">
          <div className="mp-card">
            <h3>Quick Match</h3>
            <div className="mp-row">
              <button className="gw-btn" style={{ flex: 1 }} onClick={() => mpQuickplay("1v1")}>
                1 v 1
              </button>
              <button className="gw-btn" style={{ flex: 1 }} onClick={() => mpQuickplay("2v2")}>
                2 v 2
              </button>
              <button className="gw-btn" style={{ flex: 1 }} onClick={() => mpQuickplay("3v3")}>
                3 v 3
              </button>
            </div>
            <h3 style={{ marginTop: 18 }}>Create War Room</h3>
            <div className="mp-row">
              <button className="gw-btn gw-btn-ghost" style={{ flex: 1 }} onClick={() => mpCreateRoom("1v1")}>
                NEW 1v1
              </button>
              <button className="gw-btn gw-btn-ghost" style={{ flex: 1 }} onClick={() => mpCreateRoom("2v2")}>
                NEW 2v2
              </button>
              <button className="gw-btn gw-btn-ghost" style={{ flex: 1 }} onClick={() => mpCreateRoom("3v3")}>
                NEW 3v3
              </button>
            </div>
            <p className="mp-sub" style={{ marginBottom: 0, fontSize: 12 }}>
              A created room can be started solo against bots, or wait for others to join.
            </p>
          </div>

          <div className="mp-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Open Rooms</h3>
              <button className="gw-btn gw-btn-mini gw-btn-ghost" onClick={mpRefreshRooms}>
                REFRESH
              </button>
            </div>
            {rooms.filter((r) => r.state === "lobby").length === 0 ? (
              <p className="mp-empty">No open rooms. Create one to get started.</p>
            ) : (
              <ul className="mp-rooms">
                {rooms
                  .filter((r) => r.state === "lobby")
                  .map((r) => (
                    <li key={r.id} className="mp-room-item">
                      <span className="mp-room-meta">
                        {r.id}
                        <small>
                          {r.mode} · {r.count}/{r.capacity}
                        </small>
                      </span>
                      <button
                        className="gw-btn gw-btn-mini"
                        disabled={r.count >= r.capacity}
                        onClick={() => mpJoinRoom(r.id)}
                      >
                        JOIN
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        {error && <p className="mp-error">{error}</p>}

        <div className="mp-actions">
          <button className="gw-btn gw-btn-ghost" onClick={onExit}>
            BACK TO WARCAMP
          </button>
        </div>
      </div>
    </div>
  );
}
