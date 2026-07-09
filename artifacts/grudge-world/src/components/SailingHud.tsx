import { useEffect } from "react";
import { Anchor, Compass, MapPin, Waves } from "lucide-react";
import {
  factionLabel,
  getPlayerFactionStanding,
  sectorMeta,
  type WorldIslandData,
} from "@workspace/world-content";
import { readPlayerFaction } from "@/game/playerFaction";
import { useSailing } from "@/game/sailingStore";

function standingTag(standing: "friendly" | "neutral" | "hostile") {
  const cls =
    standing === "friendly"
      ? "gw-tag-friendly"
      : standing === "hostile"
        ? "gw-tag-hostile"
        : "gw-tag-neutral";
  return <span className={`gw-tag ${cls}`}>{standing}</span>;
}

export function SailingHud({
  nearby,
  onDock,
  onBack,
}: {
  nearby: WorldIslandData | null;
  onDock: () => void;
  onBack: () => void;
}) {
  const playerFaction = readPlayerFaction();
  const { x, z, sector, transitionBanner, clearBanner } = useSailing();
  const meta = sectorMeta(sector.sx, sector.sz);
  const standing = nearby
    ? getPlayerFactionStanding(playerFaction, nearby.faction)
    : null;

  useEffect(() => {
    if (!transitionBanner) return;
    const t = window.setTimeout(clearBanner, 2800);
    return () => window.clearTimeout(t);
  }, [transitionBanner, clearBanner]);

  return (
    <div className="gw-hud">
      {transitionBanner && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(10,16,24,0.92)",
            border: "1px solid rgba(212,176,106,0.5)",
            borderRadius: 12,
            padding: "16px 28px",
            fontFamily: "Cinzel, serif",
            fontSize: "1.25rem",
            color: "#d4b06a",
            pointerEvents: "none",
          }}
        >
          {transitionBanner}
        </div>
      )}
      <div className="gw-hud-top">
        <div className="gw-hud-card">
          <h3>Sector {sector.sx + 1},{sector.sz + 1}</h3>
          <p>{meta.name}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--gw-muted)" }}>{meta.subtitle}</p>
          <p style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--gw-muted)" }}>
            <Compass size={12} style={{ display: "inline", verticalAlign: -2 }} /> {Math.round(x)}, {Math.round(z)}
          </p>
        </div>
        <div className="gw-hud-card">
          <h3>Captain</h3>
          <p>{factionLabel(playerFaction)}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          {nearby && nearby.hasPort && standing !== "hostile" && (
            <button type="button" className="gw-btn gw-btn-strong" onClick={onDock}>
              <Anchor size={16} />
              Dock at {nearby.name}
            </button>
          )}
          <button type="button" className="gw-btn gw-btn-ghost" onClick={onBack}>
            Port Menu
          </button>
        </div>
      </div>
      {nearby && (
        <div className="gw-hud-card" style={{ position: "absolute", left: 14, top: 120, maxWidth: 280 }}>
          <h3>
            <MapPin size={12} style={{ display: "inline", verticalAlign: -2 }} /> Nearby
          </h3>
          <p>
            <strong>{nearby.name}</strong> — {nearby.biome}
          </p>
          <p style={{ marginTop: 6 }}>
            {standingTag(standing!)}
            {nearby.size === "capital" && (
              <span className="gw-tag" style={{ marginLeft: 6, background: "rgba(212,176,106,0.2)", color: "#d4b06a" }}>
                capital
              </span>
            )}
          </p>
        </div>
      )}
      <div className="gw-hud-bottom">
        <Waves size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
        W A S D — sail the sector · Blue channels connect adjacent seas · Enter a channel to load the next sector
      </div>
    </div>
  );
}