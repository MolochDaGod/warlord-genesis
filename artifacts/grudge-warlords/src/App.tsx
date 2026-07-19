import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Intro } from "./pages/Intro";
import { Lobby } from "./pages/Lobby";
import { Deploy } from "./pages/Deploy";
import { Play } from "./pages/Play";
import { Missions } from "./pages/Missions";
import { HomeIsland } from "./pages/HomeIsland";
import { DungeonInstance } from "./pages/DungeonInstance";
import { MultiplayerPage } from "./components/mp/MultiplayerPage";
import { GrudgeHub } from "./components/ui/GrudgeHub";
import { useSession } from "./game/session";
import { startProfileSync } from "./lib/profileSync";
import { DEPLOY_PATH } from "./lib/deployRoutes";
import "./components/ui/gameui.css";

function App() {
  useEffect(() => {
    startProfileSync();
    void useSession.getState().restore();
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="gw-root">
        <Routes>
          <Route path="/" element={<Intro />} />
          {/* Canonical flow: / → /lobby (warcamp) → /play. /deploy = quick march orders. */}
          <Route path="/lobby" element={<Lobby />} />
          <Route path={DEPLOY_PATH} element={<Deploy />} />
          <Route path="/play" element={<Play />} />
          <Route path="/mp" element={<MultiplayerPage />} />
          {/* Flare-Boss → Warlords Era islands: missions, home-island, dungeon instances */}
          <Route path="/missions" element={<Missions />} />
          <Route path="/events" element={<Missions />} />
          <Route path="/home-island" element={<HomeIsland />} />
          <Route path="/island" element={<Navigate to="/home-island" replace />} />
          <Route path="/dungeon/:dungeonId" element={<DungeonInstance />} />
          <Route path="/dungeon" element={<Navigate to="/dungeon/DUNGEON_HOME_SHADOW_CRYPT" replace />} />
          <Route path="/warcamp" element={<Navigate to="/lobby" replace />} />
          <Route path="/battle" element={<Navigate to="/play" replace />} />
          {/* Deep links that used to 404 into intro — send to warcamp or play */}
          <Route path="/start" element={<Navigate to="/play?skirmish=1" replace />} />
          <Route path="/skirmish" element={<Navigate to="/play?skirmish=1" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GrudgeHub />
      </div>
    </BrowserRouter>
  );
}

export default App;
