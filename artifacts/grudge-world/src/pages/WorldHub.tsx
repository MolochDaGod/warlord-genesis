import { useNavigate } from "react-router-dom";
import { Anchor, Map, Ship } from "lucide-react";
import {
  SECTOR_GRID,
  SECTOR_META,
  WORLD_ENEMY_SHIPS,
  WORLD_ISLANDS,
  factionLabel,
  getCapitalIsland,
  islandsInSector,
  sectorMeta,
} from "@workspace/world-content";
import { readPlayerFaction } from "@/game/playerFaction";
import { useSailing } from "@/game/sailingStore";

const TONE_COLOR: Record<string, string> = {
  crusade: "#3b82f6",
  fabled: "#22c55e",
  legion: "#ef4444",
  pirate: "#64748b",
  neutral: "#94a3b8",
  frontier: "#a5b4fc",
};

export function WorldHub() {
  const navigate = useNavigate();
  const faction = readPlayerFaction();
  const capital = getCapitalIsland(faction);
  const { sector, warpToSector } = useSailing();

  return (
    <div className="gw-screen" style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <h1 className="gw-title">Aethermoor</h1>
      <p className="gw-sub">
        Nine connected sea sectors — sail through the blue water channels at each border to stream the next map.
        Allies patrol friendly waters; Legion raiders and pirate hunters roam the channels between sectors.
      </p>

      <div className="gw-panel" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontFamily: "Cinzel, serif", color: "var(--gw-gold)", margin: "0 0 8px", fontSize: "1.1rem" }}>
          Your Allegiance
        </h2>
        <p style={{ margin: 0 }}>{factionLabel(faction)}</p>
        {capital && (
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--gw-muted)" }}>
            Home capital: <strong>{capital.name}</strong>
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button type="button" className="gw-btn gw-btn-strong" onClick={() => navigate("/sail")}>
          <Ship size={18} />
          Set Sail
        </button>
        <button type="button" className="gw-btn" onClick={() => navigate("/island/waterfall_isle")}>
          <Anchor size={18} />
          Visit Sanctuary (Hub)
        </button>
      </div>

      <div className="gw-panel" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontFamily: "Cinzel, serif", color: "var(--gw-gold)", margin: "0 0 12px", fontSize: "1.1rem" }}>
          <Map size={16} style={{ display: "inline", verticalAlign: -2 }} /> 9 Sector Grid
        </h2>
        <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--gw-muted)" }}>
          {WORLD_ISLANDS.length} settlements · {WORLD_ENEMY_SHIPS.length} naval patrols · Current: sector{" "}
          {sector.sx + 1},{sector.sz + 1}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${SECTOR_GRID}, 1fr)`,
            gap: 8,
          }}
        >
          {SECTOR_META.map((m) => {
            const count = islandsInSector(m.sx, m.sz).length;
            const active = m.sx === sector.sx && m.sz === sector.sz;
            return (
              <button
                key={m.id}
                type="button"
                className="gw-island-card"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: active ? "rgba(212,176,106,0.6)" : undefined,
                  boxShadow: active ? "0 0 12px rgba(212,176,106,0.15)" : undefined,
                }}
                onClick={() => {
                  warpToSector(m.sx, m.sz, `Warping to ${m.name}`);
                  navigate("/sail");
                }}
              >
                <h4 style={{ color: TONE_COLOR[m.tone] }}>{m.name}</h4>
                <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--gw-muted)" }}>
                  {m.subtitle}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "0.75rem" }}>{count} islands</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="gw-panel">
        <h2 style={{ fontFamily: "Cinzel, serif", color: "var(--gw-gold)", margin: "0 0 12px", fontSize: "1.1rem" }}>
          Island Index — {sectorMeta(sector.sx, sector.sz).name}
        </h2>
        <div className="gw-island-grid">
          {islandsInSector(sector.sx, sector.sz).map((island) => (
            <button
              key={island.id}
              type="button"
              className="gw-island-card"
              style={{ textAlign: "left", cursor: "pointer" }}
              onClick={() => navigate(`/island/${island.id}`)}
            >
              <h4>{island.name}</h4>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--gw-muted)" }}>
                {island.faction} · {island.hostility} · tier {island.tier}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}