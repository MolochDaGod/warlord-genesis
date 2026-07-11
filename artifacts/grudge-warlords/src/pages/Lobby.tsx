import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../game/store";
import { DIFFICULTY, DIFFICULTY_ORDER } from "../game/config";
import { meleeDisplayName, rangedDisplayName } from "../game/canonicalLoadout";
import { useUI } from "../game/ui";
import { useSession } from "../game/session";
import { CharacterSelect } from "../components/ui/CharacterSelect";
import { CollectionHub } from "../components/ui/CollectionHub";
import { HeroCodexGrid } from "../components/ui/HeroCodexGrid";
import { StarterPick } from "../components/ui/StarterPick";
import { PackOpenOverlay } from "../components/ui/PackOpenOverlay";
import { ICONS } from "../components/ui/icons";
import { GRUDGE_FACTIONS, GRUDGE_FACTION_BY_ID } from "../engine/grudge6";
import { useRoster } from "../game/roster";
import { useMeta } from "../game/metaProgression";
import { evaluateWarcampReady, useWarcampReady, warcampBlockMessage } from "../hooks/useWarcampReady";
import { viewerUrl } from "../lib/grudgeViewer";
import { getFleetEndpoints } from "../lib/grudgeOrigins";
import { sailAethermoorUrl, GRUDGE_FLEET_URLS } from "../lib/fleetUrls";
import { getStudioToken } from "../lib/grudgeStudio";
import { ensureWarcampReady, prepareAndStartMatch } from "../lib/ensureWarcampReady";
import { markDeployDone } from "./Deploy";
import { PreMatchLaneDeploy } from "../components/ui/PreMatchLaneDeploy";
import "../components/ui/collection.css";

type LobbyTab = "warcamp" | "chest" | "codex";

export function Lobby() {
  const navigate = useNavigate();
  const startGame = useGame((s) => s.startGame);
  const mapSize = useGame((s) => s.mapSize);
  const setMapSize = useGame((s) => s.setMapSize);
  const difficulty = useGame((s) => s.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const openHub = useUI((s) => s.openHub);
  const user = useSession((s) => s.user);
  const factionId = useRoster((s) => s.factionId);
  const enemyFactionId = useRoster((s) => s.enemyFactionId);
  const raceId = useRoster((s) => s.raceId);
  const classId = useRoster((s) => s.classId);
  const prefabId = useRoster((s) => s.prefabId);
  const meleeId = useRoster((s) => s.meleeId);
  const rangedId = useRoster((s) => s.rangedId);
  const setEnemyFaction = useRoster((s) => s.setEnemyFaction);
  const lockLoadout = useRoster((s) => s.lockLoadout);
  const { ready: warlordReady, blockReason } = useWarcampReady();
  const gbux = useMeta((s) => s.gbux);
  const syncGbuxFromAccount = useMeta((s) => s.syncGbuxFromAccount);
  const [tab, setTab] = useState<LobbyTab>("warcamp");
  const [fleet, setFleet] = useState<{ world: string | null; colyseus: string | null } | null>(null);

  useEffect(() => {
    ensureWarcampReady();
  }, []);

  useEffect(() => {
    getFleetEndpoints()
      .then((e) =>
        setFleet({
          world: e.world,
          colyseus: e.colyseus ? `${e.colyseus.host}:${e.colyseus.port}` : null,
        }),
      )
      .catch(() => setFleet(null));
  }, []);

  useEffect(() => {
    if (user?.gbuxBalance != null) syncGbuxFromAccount(Number(user.gbuxBalance));
  }, [user?.gbuxBalance, syncGbuxFromAccount]);

  // Never crash the warcamp if stored faction ids are stale/corrupt.
  const playerFaction =
    GRUDGE_FACTION_BY_ID[factionId] ?? GRUDGE_FACTIONS[0] ?? {
      id: "crusade",
      name: "Crusade",
      color: "#d4a84b",
    };
  const enemyFaction =
    GRUDGE_FACTION_BY_ID[enemyFactionId] ??
    GRUDGE_FACTIONS.find((f) => f.id !== playerFaction.id) ??
    GRUDGE_FACTIONS[1] ??
    playerFaction;

  const march = () => {
    ensureWarcampReady();
    const gate = evaluateWarcampReady();
    if (!gate.ready) {
      console.warn("[warlord-genesis] march blocked", gate.blockReason);
      return;
    }
    lockLoadout();
    markDeployDone();
    // Prefer full repair+start so /play does not re-boot mid-navigate.
    const prepared = prepareAndStartMatch();
    if (!prepared.ok) {
      const ok = startGame();
      if (!ok) {
        console.warn("[warlord-genesis] march: start failed", prepared.error);
      }
    }
    navigate("/play");
  };

  return (
    <div className="gw-screen gw-lobby gw-lobby-v2">
      <StarterPick />
      <PackOpenOverlay />
      <div className="gw-lobby-top">
        <button type="button" className="gw-back" onClick={() => navigate("/")}>
          ‹ TITLE
        </button>
        <div className="gw-lobby-title-block">
          <span className="gw-lobby-title">The Warcamp</span>
          <span className="gw-lobby-tagline">Choose your warlord · arm loadout · march three lanes</span>
        </div>
        <div className="gw-lobby-top-actions">
          <a
            className="gw-btn gw-btn-ghost gw-btn-mini"
            href={viewerUrl(raceId, classId)}
            target="_blank"
            rel="noreferrer"
          >
            VIEWER
          </a>
          <span className="gw-lobby-gbux" title="Grudge Bux">
            {gbux} GBUX
          </span>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("account")}>
            <img className="gw-btn-icon" src={ICONS.fist} alt="" draggable={false} />
            {user ? user.displayName || user.username : "SIGN IN"}
          </button>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("codex")}>
            <img className="gw-btn-icon" src={ICONS.chest} alt="" draggable={false} />
            CODEX
          </button>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("ai")}>
            <img className="gw-btn-icon" src={ICONS.chat} alt="" draggable={false} />
            COUNCIL
          </button>
        </div>
      </div>

      <div className="gw-lobby-tabs">
        <button
          type="button"
          className={`gw-lobby-tab${tab === "warcamp" ? " is-active" : ""}`}
          onClick={() => setTab("warcamp")}
        >
          Warcamp
        </button>
        <button
          type="button"
          className={`gw-lobby-tab${tab === "chest" ? " is-active" : ""}`}
          onClick={() => setTab("chest")}
        >
          War Chest
        </button>
        <button
          type="button"
          className={`gw-lobby-tab${tab === "codex" ? " is-active" : ""}`}
          onClick={() => setTab("codex")}
        >
          Hero Codex
        </button>
      </div>

      <div className="gw-lobby-grid gw-lobby-grid-v2">
        <div className="gw-lobby-main">
          {tab === "warcamp" ? <CharacterSelect /> : tab === "chest" ? <CollectionHub /> : <HeroCodexGrid />}
        </div>

        <aside className="gw-lobby-deploy">
          <div className="gw-deploy-panel">
            <span className="gw-deploy-head">March Orders</span>

            <div className="gw-deploy-summary">
              <div className="gw-deploy-row">
                <span className="gw-deploy-k">Warlord</span>
                <span className="gw-deploy-v">{prefabId.replace(/-/g, " ")}</span>
              </div>
              <div className="gw-deploy-row">
                <span className="gw-deploy-k">Your faction</span>
                <span className="gw-deploy-v" style={{ color: playerFaction.color }}>
                  {playerFaction.name}
                </span>
              </div>
              <div className="gw-deploy-row">
                <span className="gw-deploy-k">Opponent</span>
                <span className="gw-deploy-v" style={{ color: enemyFaction.color }}>
                  {enemyFaction.name}
                </span>
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

            <PreMatchLaneDeploy compact />

            <div className="gw-mapsize">
              <span className="gw-mapsize-label">Opponent faction</span>
              <div className="gw-mapsize-toggle">
                {GRUDGE_FACTIONS.filter((f) => f.id !== factionId).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`gw-btn gw-btn-ghost gw-btn-mini${enemyFactionId === f.id ? " gw-active" : ""}`}
                    onClick={() => setEnemyFaction(f.id)}
                  >
                    {f.name.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="gw-deploy-summary" style={{ marginTop: "0.75rem" }}>
              <span className="gw-deploy-head">Open World</span>
              <a
                className="gw-deploy-v"
                href={sailAethermoorUrl(getStudioToken())}
                target="_blank"
                rel="noreferrer"
              >
                Sail Aethermoor
              </a>
              {fleet?.world && (
                <a className="gw-deploy-hint" href={fleet.world} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 4 }}>
                  Live fleet: {fleet.world}
                </a>
              )}
              {fleet?.colyseus && (
                <span className="gw-deploy-hint" title="Colyseus PvP host">
                  PvP: {fleet.colyseus}
                </span>
              )}
              <a
                className="gw-deploy-hint"
                href={`${GRUDGE_FLEET_URLS.water}/barracks`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", marginTop: 4 }}
              >
                Barracks studio (water)
              </a>
            </div>

            <button
              type="button"
              className="gw-btn gw-lobby-march"
              onClick={march}
              disabled={!warlordReady}
              title={
                warlordReady
                  ? "Deploy with chosen warlord and canonical weapons"
                  : "Unlock warlord in War Chest or finish loadout"
              }
            >
              MARCH TO WAR
            </button>
            <button
              type="button"
              className="gw-btn gw-btn-ghost"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => {
                ensureWarcampReady();
                if (evaluateWarcampReady().ready) lockLoadout();
                navigate("/mp");
              }}
            >
              ONLINE WAR · ROOMS
            </button>
            {!warlordReady && blockReason && (
              <span className="gw-deploy-hint">{warcampBlockMessage(blockReason)}</span>
            )}
            {warlordReady && (
              <span className="gw-deploy-hint gw-deploy-hint--ok">
                Ready — gear, lane guards, and wave deploy set. March or open Online War.
              </span>
            )}
          </div>

          <div className="gw-deploy-panel gw-deploy-pipeline">
            <span className="gw-deploy-head">Visual Pipeline</span>
            <ul className="gw-pipeline-list">
              <li><strong>You + lane guards</strong> — GRUDGE6 Bip001 (viewer)</li>
              <li><strong>Lane creeps</strong> — KayKit faction mobs</li>
              <li><strong>Enemy warlord</strong> — GRUDGE6 worge mesh</li>
            </ul>
          </div>

          <div className="gw-deploy-panel">
            <span className="gw-deploy-head">Field Orders</span>
            <div className="gw-controls-grid gw-controls-lobby">
              <div><kbd>`</kbd> Warrior / Warlord</div>
              <div><kbd>W A S D</kbd> Move Hero</div>
              <div><kbd>Click</kbd> Fire</div>
              <div><kbd>L-Drag</kbd> Select</div>
              <div><kbd>R-Click</kbd> Command</div>
              <div><kbd>1–5</kbd> Fortify</div>
              <div><kbd>Shift+1-5</kbd> Set Group</div>
              <div><kbd>Ctrl+1-5</kbd> Recall Group</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}