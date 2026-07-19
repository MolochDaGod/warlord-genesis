/**
 * Home-island surface — tutorial missions, shadow shrine event, micro-dungeon.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  homeIslandContent,
  activateMission,
  loadMissionRuns,
  DARK_ELF_EVENT_SITES,
} from "../game/flareIslandContent";

export function HomeIsland() {
  const navigate = useNavigate();
  const content = useMemo(() => homeIslandContent(), []);
  const runs = useMemo(() => loadMissionRuns(), []);
  const shrine = DARK_ELF_EVENT_SITES.find((e) => e.id === "event_home_shadow_shrine");

  return (
    <div style={page}>
      <header style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" style={btn} onClick={() => navigate("/lobby")}>
          ← Warcamp
        </button>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Cinzel, serif" }}>Home Island</h1>
          <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
            Warlords Era · harvest · shadow shrine · whisps
          </p>
        </div>
      </header>

      <section style={section}>
        <h2 style={h2}>Active island scripts</h2>
        <div style={grid}>
          {content.missions.map((m) => (
            <article key={m.id} style={card}>
              <strong>{m.title}</strong>
              <p style={desc}>{m.description}</p>
              <p style={meta}>status: {runs[m.id]?.state ?? "not_started"}</p>
              <button
                type="button"
                style={primary}
                onClick={() => activateMission(m.id)}
              >
                Activate mission
              </button>
            </article>
          ))}
        </div>
      </section>

      {shrine && (
        <section style={section}>
          <h2 style={h2}>Event: {shrine.name}</h2>
          <p style={desc}>{shrine.description}</p>
          <p style={meta}>
            Spawns:{" "}
            {shrine.spawns.map((s) => `${s.count}× ${s.unitId}`).join(", ")}
          </p>
          <button
            type="button"
            style={primary}
            onClick={() => navigate("/dungeon/DUNGEON_HOME_SHADOW_CRYPT")}
          >
            Enter Shadow Crypt instance
          </button>
        </section>
      )}

      <section style={section}>
        <h2 style={h2}>Whisps on this island</h2>
        <ul>
          {content.whisps.map((w) => (
            <li key={w.id} style={{ color: `#${w.color.toString(16).padStart(6, "0")}` }}>
              {w.name} — {w.description}
            </li>
          ))}
        </ul>
      </section>

      <p style={{ fontSize: 12, opacity: 0.55 }}>
        Full 3D home-island terrain mounts via water.grudge-studio.com / island engines; this page
        owns mission/event/dungeon script entry for the Flare-Boss port.
      </p>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 20,
  background: "linear-gradient(180deg, #0f1a14 0%, #0a0c10 100%)",
  color: "#e7e5e4",
};
const section: React.CSSProperties = { marginTop: 24 };
const h2: React.CSSProperties = { color: "#86efac", fontFamily: "Cinzel, serif" };
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: 12,
};
const card: React.CSSProperties = {
  background: "rgba(10,20,16,0.9)",
  border: "1px solid rgba(74,222,128,0.25)",
  borderRadius: 12,
  padding: 14,
};
const desc: React.CSSProperties = { fontSize: 13, opacity: 0.85 };
const meta: React.CSSProperties = { fontSize: 11, opacity: 0.6 };
const btn: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#e7e5e4",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
};
const primary: React.CSSProperties = {
  ...btn,
  background: "linear-gradient(135deg, #16a34a, #166534)",
  border: "none",
  fontWeight: 600,
};
