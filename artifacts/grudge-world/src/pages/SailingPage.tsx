import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WorldIslandData } from "@workspace/world-content";
import { WorldMapScene } from "@/components/WorldMapScene";
import { SailingHud } from "@/components/SailingHud";

export function SailingPage() {
  const navigate = useNavigate();
  const [nearby, setNearby] = useState<WorldIslandData | null>(null);

  const dock = () => {
    if (!nearby) return;
    navigate(`/island/${nearby.id}`);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>
      <WorldMapScene onDockReady={setNearby} />
      <SailingHud nearby={nearby} onDock={dock} onBack={() => navigate("/")} />
    </div>
  );
}