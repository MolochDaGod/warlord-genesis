import { useNavigate } from "react-router-dom";
import { useGame } from "../game/store";
import { DIFFICULTY, DIFFICULTY_ORDER } from "../game/config";
import { useUI } from "../game/ui";
import { useSession } from "../game/session";
import { CharacterSelect } from "../components/ui/CharacterSelect";
import { ICONS } from "../components/ui/icons";

export function Lobby() {
  const navigate = useNavigate();
  const startGame = useGame((s) => s.startGame);
  const mapSize = useGame((s) => s.mapSize);
  const setMapSize = useGame((s) => s.setMapSize);
  const difficulty = useGame((s) => s.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const openHub = useUI((s) => s.openHub);
  const user = useSession((s) => s.user);

  const march = () => {
    startGame();
    navigate("/play");
  };

  return (
    <div className="gw-screen gw-lobby">
      <div className="gw-lobby-top">
        <button className="gw-back" onClick={() => navigate("/")}>
          ‹ TITLE
        </button>
        <span className="gw-lobby-title">The Warcamp</span>
        <div className="gw-lobby-top-actions">
          <button className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("account")}>
            <img className="gw-btn-icon" src={ICONS.fist} alt="" draggable={false} />
            {user ? user.displayName || user.username : "SIGN IN"}
          </button>
          <button className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("codex")}>
            <img className="gw-btn-icon" src={ICONS.chest} alt="" draggable={false} />
            CODEX
          </button>
          <button className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("ai")}>
            <img className="gw-btn-icon" src={ICONS.chat} alt="" draggable={false} />
            COUNCIL
          </button>
        </div>
      </div>

      <div className="gw-lobby-grid">
        <div className="gw-lobby-main">
          <CharacterSelect />
        </div>

        <aside className="gw-lobby-deploy">
          <div className="gw-deploy-panel">
            <span className="gw-deploy-head">Deployment</span>
            <div className="gw-mapsize">
              <span className="gw-mapsize-label">Battlefield</span>
              <div className="gw-mapsize-toggle">
                <button
                  type="button"
                  className={`gw-btn gw-btn-ghost gw-btn-mini${mapSize === "standard" ? " gw-active" : ""}`}
                  onClick={() => setMapSize("standard")}
                >
                  STANDARD
                </button>
                <button
                  type="button"
                  className={`gw-btn gw-btn-ghost gw-btn-mini${mapSize === "large" ? " gw-active" : ""}`}
                  onClick={() => setMapSize("large")}
                >
                  LARGE
                </button>
              </div>
            </div>
            <div className="gw-mapsize">
              <span className="gw-mapsize-label">Difficulty</span>
              <div className="gw-mapsize-toggle">
                {DIFFICULTY_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`gw-btn gw-btn-ghost gw-btn-mini${difficulty === id ? " gw-active" : ""}`}
                    onClick={() => setDifficulty(id)}
                  >
                    {DIFFICULTY[id].name.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button className="gw-btn gw-lobby-march" onClick={march}>
              MARCH TO WAR
            </button>
          </div>

          <div className="gw-deploy-panel">
            <span className="gw-deploy-head">Field Orders</span>
            <div className="gw-controls-grid gw-controls-lobby">
              <div><kbd>`</kbd> Warrior / Warlord</div>
              <div><kbd>W A S D</kbd> Move Hero</div>
              <div><kbd>Click</kbd> Fire</div>
              <div><kbd>L-Drag</kbd> Select</div>
              <div><kbd>R-Click</kbd> Command</div>
              <div><kbd>A</kbd> Attack-Move</div>
              <div><kbd>M</kbd> Move</div>
              <div><kbd>H</kbd> Hold</div>
              <div><kbd>S</kbd> Stop</div>
              <div><kbd>B</kbd> Build</div>
              <div><kbd>Shift+1-5</kbd> Set Group</div>
              <div><kbd>1-5</kbd> Recall Group</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
