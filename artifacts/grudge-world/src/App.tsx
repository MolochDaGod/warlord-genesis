import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { WorldHub } from "./pages/WorldHub";
import { SailingPage } from "./pages/SailingPage";
import { IslandLandingPage } from "./pages/IslandLandingPage";
import "./world.css";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<WorldHub />} />
        <Route path="/sail" element={<SailingPage />} />
        <Route path="/island/:islandId" element={<IslandLandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}