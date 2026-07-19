import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Intro } from "./pages/Intro";
import { AuthCallback } from "./pages/AuthCallback";
import { FactionSelect } from "./pages/FactionSelect";
import { WarlordSelect } from "./pages/WarlordSelect";
import { Lobby } from "./pages/Lobby";
import { Deploy } from "./pages/Deploy";
import { Play } from "./pages/Play";
import { Missions } from "./pages/Missions";
import { HomeIsland } from "./pages/HomeIsland";
import { DungeonInstance } from "./pages/DungeonInstance";
import { MultiplayerPage } from "./components/mp/MultiplayerPage";
import { GrudgeHub } from "./components/ui/GrudgeHub";
import { RequireSession } from "./components/ui/RequireSession";
import { useSession } from "./game/session";
import { startProfileSync } from "./lib/profileSync";
import { DEPLOY_PATH } from "./lib/deployRoutes";
import "./components/ui/gameui.css";

function Gate({ children }: { children: React.ReactNode }) {
  return <RequireSession allowGuest>{children}</RequireSession>;
}

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
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/onboarding/faction" element={<FactionSelect />} />
          <Route path="/onboarding/warlord" element={<WarlordSelect />} />
          {/* Canonical: login → faction → warlord → /lobby → /play */}
          <Route path="/lobby" element={<Gate><Lobby /></Gate>} />
          <Route path={DEPLOY_PATH} element={<Gate><Deploy /></Gate>} />
          <Route path="/play" element={<Gate><Play /></Gate>} />
          <Route path="/mp" element={<Gate><MultiplayerPage /></Gate>} />
          <Route path="/missions" element={<Gate><Missions /></Gate>} />
          <Route path="/events" element={<Gate><Missions /></Gate>} />
          <Route path="/home-island" element={<Gate><HomeIsland /></Gate>} />
          <Route path="/island" element={<Navigate to="/home-island" replace />} />
          <Route path="/dungeon/:dungeonId" element={<Gate><DungeonInstance /></Gate>} />
          <Route path="/dungeon" element={<Navigate to="/dungeon/DUNGEON_HOME_SHADOW_CRYPT" replace />} />
          <Route path="/warcamp" element={<Navigate to="/lobby" replace />} />
          <Route path="/battle" element={<Navigate to="/play" replace />} />
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
