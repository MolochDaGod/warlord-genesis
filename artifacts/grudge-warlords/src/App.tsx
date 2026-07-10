import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Intro } from "./pages/Intro";
import { Lobby } from "./pages/Lobby";
import { Deploy } from "./pages/Deploy";
import { Play } from "./pages/Play";
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
          {/* /lobby is the canonical warcamp; /deploy is an alias used by fleet links */}
          <Route path="/lobby" element={<Lobby />} />
          <Route path={DEPLOY_PATH} element={<Deploy />} />
          <Route path="/play" element={<Play />} />
          <Route path="/mp" element={<MultiplayerPage />} />
          <Route path="/warcamp" element={<Navigate to="/lobby" replace />} />
          <Route path="/battle" element={<Navigate to="/play" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GrudgeHub />
      </div>
    </BrowserRouter>
  );
}

export default App;
