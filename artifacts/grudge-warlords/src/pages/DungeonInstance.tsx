/**
 * Dungeon instance shell — runs Flare-port room scripts (Briar Depths, Shadow Crypt).
 * Full 3D combat can mount Game canvas later; this wires catalog → progress → rewards.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getDungeon,
  buildRoomSpawnList,
  resolveSpawnCombat,
  bumpMissionObjective,
  activateMission,
} from "../game/flareIslandContent";

export function DungeonInstance() {
  const { dungeonId = "" } = useParams();
  const navigate = useNavigate();
  const dungeon = useMemo(() => getDungeon(dungeonId), [dungeonId]);
  const [roomIndex, setRoomIndex] = useState(0);
  const [cleared, setCleared] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const room = dungeon?.rooms[roomIndex];
  const spawns = useMemo(() => {
    if (!dungeon || !room) return [];
    return buildRoomSpawnList(room, dungeon.spawnPolicy);
  }, [dungeon, room]);

  if (!dungeon) {
    return (
      <div style={page}>
        <p>Unknown dungeon: {dungeonId}</p>
        <button type="button" onClick={() => navigate("/missions")} style={btn}>
          Back to missions
        </button>
      </div>
    );
  }

  const done = cleared.includes(room?.id ?? "");

  const pushLog = (line: string) => setLog((L) => [line, ...L].slice(0, 12));

  const clearRoom = () => {
    if (!room) return;
    for (const s of spawns) {
      const combat = resolveSpawnCombat(s.templateId);
      pushLog(
        `Cleared ${s.count}× ${combat?.name ?? s.templateId}` +
          (combat ? ` (${combat.hp} HP)` : ""),
      );
      if (s.templateId.startsWith("dark_elf")) {
        for (const mid of dungeon.missionIds) {
          bumpMissionObjective(mid, "kill_scouts", s.count);
          bumpMissionObjective(mid, "kill_raiders", s.count);
          if (s.templateId === "dark_elf_assassin")
            bumpMissionObjective(mid, "kill_assassin", s.count);
          if (s.templateId === "dark_elf_sorceress")
            bumpMissionObjective(mid, "kill_sorceress", s.count);
          if (s.templateId === "dark_elf_matriarch")
            bumpMissionObjective(mid, "kill_matriarch", 1);
        }
      }
    }
    if (room.type === "whisp_cage") {
      for (const mid of dungeon.missionIds) {
        bumpMissionObjective(mid, "free_whisp", 1);
        bumpMissionObjective(mid, "free_3", 1);
      }
      pushLog("Freed caged whisps");
    }
    if (room.type === "boss") {
      for (const mid of dungeon.missionIds) {
        bumpMissionObjective(mid, "enter_dungeon", 1);
        bumpMissionObjective(mid, "kill_matriarch", 1);
      }
      pushLog(`Boss down — ${dungeon.bossUnitId}`);
    }
    setCleared((c) => [...c, room.id]);
  };

  const nextRoom = () => {
    if (roomIndex < dungeon.rooms.length - 1) {
      setRoomIndex((i) => i + 1);
    } else {
      pushLog(
        `Dungeon clear! +${dungeon.clearRewards.gold}g +${dungeon.clearRewards.xp} XP`,
      );
      for (const mid of dungeon.missionIds) activateMission(mid);
    }
  };

  return (
    <div style={page}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <button type="button" style={btn} onClick={() => navigate("/missions")}>
          ← Missions
        </button>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Cinzel, serif" }}>{dungeon.name}</h1>
          <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>{dungeon.subtitle}</p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        <div style={panel}>
          <h2 style={{ marginTop: 0, color: "#c4b5fd" }}>
            Room {roomIndex + 1}/{dungeon.rooms.length}: {room?.name}
          </h2>
          <p style={{ opacity: 0.8 }}>{room?.objectiveHint ?? room?.type}</p>
          <p style={{ fontSize: 12, opacity: 0.6 }}>
            Size {room?.size.w}×{room?.size.d}m · type {room?.type}
          </p>

          <h3 style={{ color: "#e9d5ff", fontSize: 14 }}>Spawns (Flare-style script)</h3>
          <ul>
            {spawns.map((s, i) => {
              const c = resolveSpawnCombat(s.templateId);
              return (
                <li key={`${s.templateId}-${i}`}>
                  {s.count}× {c?.name ?? s.templateId}
                  {c ? ` — HP ${c.hp}, dmg ${c.damage}` : ""}
                </li>
              );
            })}
            {!spawns.length && <li style={{ opacity: 0.5 }}>No combat spawns</li>}
          </ul>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              style={primary}
              disabled={done || !spawns.length}
              onClick={clearRoom}
            >
              {done ? "Room cleared" : "Clear room (script)"}
            </button>
            <button
              type="button"
              style={primary}
              disabled={!done && !!spawns.length}
              onClick={nextRoom}
            >
              {roomIndex >= dungeon.rooms.length - 1 ? "Finish dungeon" : "Next room →"}
            </button>
          </div>

          <p style={{ fontSize: 11, opacity: 0.55, marginTop: 16 }}>
            Source: {dungeon.source}. 3D combat canvas can mount on this route; scripts already
            drive mission progress, loot tables, and sector events.
          </p>
        </div>

        <aside style={panel}>
          <h3 style={{ marginTop: 0, color: "#fbbf24" }}>Run log</h3>
          <ul style={{ fontSize: 12, paddingLeft: 16 }}>
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
            {!log.length && <li style={{ opacity: 0.5 }}>Clear rooms to advance scripts…</li>}
          </ul>
          <h3 style={{ color: "#a7f3d0" }}>Clear rewards</h3>
          <p style={{ fontSize: 12 }}>
            {dungeon.clearRewards.gold}g · {dungeon.clearRewards.xp} XP
          </p>
          <ul style={{ fontSize: 12 }}>
            {dungeon.clearRewards.items.map(([id, n]) => (
              <li key={id}>
                {n}× {id}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 20,
  background: "radial-gradient(ellipse at center, #1c1228 0%, #08060c 70%)",
  color: "#e7e5e4",
};
const panel: React.CSSProperties = {
  background: "rgba(18,12,28,0.9)",
  border: "1px solid rgba(168,85,247,0.3)",
  borderRadius: 12,
  padding: 16,
};
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
  background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
  border: "none",
  fontWeight: 600,
};
