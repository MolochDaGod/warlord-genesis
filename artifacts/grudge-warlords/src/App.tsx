import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Intro } from "./pages/Intro";
import { Lobby } from "./pages/Lobby";
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
          <Route path="/lobby" element={<Navigate to={DEPLOY_PATH} replace />} />
          <Route path="/deploy" element={<Lobby />} />
          <Route path="/play" element={<Play />} />
          <Route path="/mp" element={<MultiplayerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GrudgeHub />
      </div>
    </BrowserRouter>
  );
}

export default App;
