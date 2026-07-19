/**
 * Mission board + dungeon/instance entries for Warlords Era islands.
 * Content: Flare-Boss port (dark elves, whisps, dungeon scripts).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ISLAND_MISSIONS,
  DARK_ELF_UNITS,
  WHISP_DEFS,
  listInstanceEntries,
  homeIslandContent,
  buildAllSectorContent,
  activateMission,
  loadMissionRuns,
  FLARE_PORT_VERSION,
  type IslandMission,
} from "../game/flareIslandContent";

export function Missions() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "home" | "sector" | "dungeon">("all");
  const runs = useMemo(() => loadMissionRuns(), []);
  const home = useMemo(() => homeIslandContent(), []);
  const sectors = useMemo(() => buildAllSectorContent(), []);
  const instances = useMemo(() => listInstanceEntries(), []);

  const missions: IslandMission[] = useMemo(() => {
    if (filter === "home") return home.missions;
    if (filter === "dungeon")
      return ISLAND_MISSIONS.filter((m) => m.category === "dungeon" || m.surfaces.includes("dungeon"));
    if (filter === "sector")
      return ISLAND_MISSIONS.filter((m) => m.surfaces.includes("sector-map"));
    return ISLAND_MISSIONS;
  }, [filter, home.missions]);

  return (
    <div className="gw-missions" style={pageStyle}>
      <header style={headerStyle}>
        <button type="button" style={backBtn} onClick={() => navigate("/lobby")}>
          ← Warcamp
        </button>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Cinzel, serif", letterSpacing: "0.06em" }}>
            Island Missions & Instances
          </h1>
          <p style={{ margin: "4px 0 0", opacity: 0.75, fontSize: 13 }}>
            Flare-Boss port v{FLARE_PORT_VERSION} · dark elves · whisps · 9 sectors · home-island
          </p>
        </div>
      </header>

      <div style={filterRow}>
        {(["all", "home", "sector", "dungeon"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              ...chip,
              background: filter === f ? "rgba(168,85,247,0.35)" : "rgba(0,0,0,0.35)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <section style={section}>
        <h2 style={h2}>Missions</h2>
        <div style={grid}>
          {missions.map((m) => {
            const run = runs[m.id];
            const status = run?.state ?? "not_started";
            return (
              <article key={m.id} id={m.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: "#e9d5ff" }}>{m.title}</strong>
                  <span style={badge}>{status}</span>
                </div>
                <p style={desc}>{m.description}</p>
                <p style={meta}>
                  Lv {m.recommendedLevel} · {m.category} · zone {m.zoneRestriction ?? "any"}
                </p>
                <ul style={objList}>
                  {m.objectives.map((o) => (
                    <li key={o.id}>
                      {o.description}
                      {run ? ` · ${run.objectiveProgress[o.id] ?? 0}/${o.requiredCount}` : ""}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  style={primaryBtn}
                  onClick={() => {
                    activateMission(m.id);
                    if (m.surfaces.includes("dungeon") && m.objectives.some((o) => o.dungeonId)) {
                      const dId = m.objectives.find((o) => o.dungeonId)?.dungeonId;
                      if (dId) navigate(`/dungeon/${dId}`);
                    } else if (m.zoneRestriction === "home") {
                      navigate("/home-island");
                    } else {
                      navigate("/lobby");
                    }
                  }}
                >
                  {status === "completed" ? "View" : "Accept / Continue"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section style={section}>
        <h2 style={h2}>Dungeons & events</h2>
        <div style={grid}>
          {instances.map((e) => (
            <article key={e.id} style={card}>
              <strong style={{ color: e.kind === "dungeon" ? "#fbbf24" : "#c4b5fd" }}>
                {e.name}
              </strong>
              <p style={meta}>
                {e.kind} · sector {e.sectorId.toUpperCase()} · Lv {e.recommendedLevel}+
              </p>
              <button
                type="button"
                style={primaryBtn}
                onClick={() =>
                  e.kind === "dungeon"
                    ? navigate(`/dungeon/${e.id}`)
                    : navigate(`/events#${e.id}`)
                }
              >
                Enter
              </button>
            </article>
          ))}
        </div>
      </section>

      <section style={section} id="whisps">
        <h2 style={h2}>Whisps</h2>
        <div style={grid}>
          {WHISP_DEFS.map((w) => (
            <article key={w.id} style={card}>
              <strong style={{ color: `#${w.color.toString(16).padStart(6, "0")}` }}>
                {w.name}
              </strong>
              <p style={desc}>{w.description}</p>
              <p style={meta}>sectors: {w.sectorIds.join(", ")}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2 style={h2}>Dark elf roster</h2>
        <div style={grid}>
          {DARK_ELF_UNITS.map((u) => (
            <article key={u.id} style={card}>
              <strong style={{ color: "#d8b4fe" }}>{u.name}</strong>
              <p style={meta}>
                Lv {u.level} · HP {u.hp} · dmg {u.damage} · {u.role}
              </p>
              <p style={desc}>Sectors: {u.sectorIds.join(", ")}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2 style={h2}>9-sector content</h2>
        <div style={grid}>
          {sectors.map((b) => (
            <article key={b.sector.id} style={card}>
              <strong>
                {b.sector.name}{" "}
                <span style={{ opacity: 0.6 }}>({b.sector.id.toUpperCase()})</span>
              </strong>
              <p style={meta}>{b.sector.subtitle}</p>
              <ul style={objList}>
                {b.lobbyHooks.map((h) => (
                  <li key={h}>{h}</li>
                ))}
                {!b.lobbyHooks.length && <li style={{ opacity: 0.5 }}>No dark-elf hooks</li>}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "20px 24px 48px",
  background: "radial-gradient(ellipse at top, #1a1028 0%, #0a0a0f 55%)",
  color: "#e7e5e4",
  overflow: "auto",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 20,
};
const backBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#e7e5e4",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
};
const filterRow: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" };
const chip: React.CSSProperties = {
  border: "1px solid rgba(168,85,247,0.4)",
  color: "#e9d5ff",
  padding: "6px 12px",
  borderRadius: 999,
  cursor: "pointer",
  textTransform: "capitalize",
};
const section: React.CSSProperties = { marginBottom: 28 };
const h2: React.CSSProperties = {
  fontFamily: "Cinzel, serif",
  fontSize: 18,
  letterSpacing: "0.04em",
  margin: "0 0 12px",
  color: "#c4b5fd",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 12,
};
const card: React.CSSProperties = {
  background: "rgba(20,12,32,0.85)",
  border: "1px solid rgba(168,85,247,0.25)",
  borderRadius: 12,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const desc: React.CSSProperties = { margin: 0, fontSize: 13, opacity: 0.85, lineHeight: 1.4 };
const meta: React.CSSProperties = { margin: 0, fontSize: 11, opacity: 0.6 };
const objList: React.CSSProperties = { margin: 0, paddingLeft: 18, fontSize: 12, opacity: 0.8 };
const badge: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  opacity: 0.7,
};
const primaryBtn: React.CSSProperties = {
  marginTop: "auto",
  background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
  border: "none",
  color: "#fff",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};
