import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Anchor, Ship, Swords, Users } from "lucide-react";
import {
  WORLD_ISLANDS,
  WORLD_ENEMY_SHIPS,
  factionLabel,
  getPlayerFactionStanding,
  resolveLandedIsland,
} from "@workspace/world-content";
import {
  QUEST_GIVER_NAMES,
  npcsForIsland,
} from "@workspace/world-content";
import { readPlayerFaction } from "@/game/playerFaction";

function standingLabel(s: "friendly" | "neutral" | "hostile") {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function IslandLandingPage() {
  const { islandId } = useParams<{ islandId: string }>();
  const navigate = useNavigate();
  const playerFaction = readPlayerFaction();

  const island = useMemo(
    () => WORLD_ISLANDS.find((i) => i.id === islandId) ?? null,
    [islandId],
  );
  const landed = resolveLandedIsland(islandId);

  if (!island || !landed) {
    return (
      <div className="gw-screen" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Unknown island.</p>
        <button type="button" className="gw-btn" onClick={() => navigate("/")}>
          Return to Port
        </button>
      </div>
    );
  }

  const standing = getPlayerFactionStanding(playerFaction, island.faction);
  const npcs = npcsForIsland(island);
  const nearbyShips = WORLD_ENEMY_SHIPS.filter((s) => {
    const dx = s.patrolCenter.x - island.position.x;
    const dz = s.patrolCenter.z - island.position.z;
    return Math.hypot(dx, dz) < s.patrolRadius + island.radius + 200;
  });

  return (
    <div className="gw-screen" style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="gw-title">{island.name}</h1>
          <p className="gw-sub" style={{ marginBottom: 0 }}>
            {island.description}
          </p>
        </div>
        <button type="button" className="gw-btn" onClick={() => navigate("/sail")}>
          <Ship size={16} />
          Set Sail
        </button>
      </div>

      <div className="gw-panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, fontSize: "0.85rem" }}>
          <div><span style={{ color: "var(--gw-muted)" }}>Faction</span><br />{factionLabel(island.faction)}</div>
          <div><span style={{ color: "var(--gw-muted)" }}>Standing</span><br />{standingLabel(standing)}</div>
          <div><span style={{ color: "var(--gw-muted)" }}>Biome</span><br />{island.biome}</div>
          <div><span style={{ color: "var(--gw-muted)" }}>Tier</span><br />{island.tier}</div>
          <div><span style={{ color: "var(--gw-muted)" }}>Port</span><br />{island.hasPort ? "Yes" : "No"}</div>
          <div><span style={{ color: "var(--gw-muted)" }}>Temple</span><br />{island.hasTemple ? island.patronGod ?? "Yes" : "No"}</div>
        </div>
      </div>

      <div className="gw-panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "Cinzel, serif", color: "var(--gw-gold)", margin: "0 0 10px", fontSize: "1rem" }}>
          <Users size={14} style={{ display: "inline", verticalAlign: -2 }} /> Town NPCs
        </h2>
        <ul className="gw-npc-list">
          {npcs.map((n) => (
            <li key={n.role} title={n.description}>
              {n.icon} {n.label}
            </li>
          ))}
        </ul>
        {island.questGiverIds && island.questGiverIds.length > 0 && (
          <div style={{ marginTop: 12, fontSize: "0.85rem" }}>
            <strong>Quest givers:</strong>{" "}
            {island.questGiverIds.map((id) => QUEST_GIVER_NAMES[id] ?? id).join(", ")}
          </div>
        )}
      </div>

      {island.enemyConfig && (
        <div className="gw-panel" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "Cinzel, serif", color: "#fca5a5", margin: "0 0 10px", fontSize: "1rem" }}>
            <Swords size={14} style={{ display: "inline", verticalAlign: -2 }} /> Island Defenders
          </h2>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>
            {island.enemyConfig.enemyCount} {island.enemyConfig.enemyTypes.join(", ")}
            {island.enemyConfig.bossType && ` · Boss: ${island.enemyConfig.bossType}`}
          </p>
        </div>
      )}

      {nearbyShips.length > 0 && (
        <div className="gw-panel" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "Cinzel, serif", color: "var(--gw-gold)", margin: "0 0 10px", fontSize: "1rem" }}>
            <Anchor size={14} style={{ display: "inline", verticalAlign: -2 }} /> Nearby Naval Traffic
          </h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.85rem" }}>
            {nearbyShips.map((s) => (
              <li key={s.id}>
                {s.name} ({s.faction}) — {s.aggressive ? "hostile" : "patrol"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="gw-panel">
        <h2 style={{ fontFamily: "Cinzel, serif", color: "var(--gw-gold)", margin: "0 0 8px", fontSize: "1rem" }}>
          Resources
        </h2>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>{island.resources.join(", ")}</p>
        {(island.buildingSlots || island.isClaimable) && (
          <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--gw-muted)" }}>
            {island.isClaimable && "Claimable territory · "}
            {island.buildingSlots && `${island.buildingSlots} building slots`}
          </p>
        )}
      </div>
    </div>
  );
}