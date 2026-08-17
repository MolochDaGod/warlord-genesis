import { useCallback, useMemo, useRef, useState } from "react";
import { FACTIONS, PREFABS, type PrefabCharacter } from "@workspace/game-content";
import { allCodexHeroes } from "../../lib/heroCodex";
import { resolvePortraitUrl } from "../../lib/heroMedia";
import { HeroDetailModal } from "./HeroDetailModal";
import "./collection.css";

type FactionTab = "all" | "crusade" | "fabled" | "legion";

const FACTION_META: Record<
  Exclude<FactionTab, "all">,
  { name: string; color: string; blurb: string }
> = {
  crusade: {
    name: "Crusade",
    color: "#d4a84b",
    blurb: "Human & barbarian hosts — steel, faith, and warbands.",
  },
  fabled: {
    name: "Fabled",
    color: "#6ec8ff",
    blurb: "Elves & dwarves — precision, craft, and arcane lines.",
  },
  legion: {
    name: "Legion",
    color: "#9d6bff",
    blurb: "Orcs & undead — brutal pressure and dark ranks.",
  },
};

/**
 * Hero Codex — faction halls + horizontal carousels (not a 1-card stack).
 * Click a card for detail / video / AI.
 */
export function HeroCodexGrid() {
  const [factionTab, setFactionTab] = useState<FactionTab>("all");
  const [search, setSearch] = useState("");
  const [inspect, setInspect] = useState<PrefabCharacter | null>(null);
  const codexCount = allCodexHeroes().length;

  const byFaction = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (p: PrefabCharacter) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.classId.toLowerCase().includes(q)
      );
    };
    const groups: Record<Exclude<FactionTab, "all">, PrefabCharacter[]> = {
      crusade: [],
      fabled: [],
      legion: [],
    };
    for (const p of PREFABS) {
      if (!match(p)) continue;
      if (p.faction === "crusade" || p.faction === "fabled" || p.faction === "legion") {
        groups[p.faction].push(p);
      }
    }
    return groups;
  }, [search]);

  const halls = useMemo(() => {
    if (factionTab === "all") {
      return (["crusade", "fabled", "legion"] as const).map((id) => ({
        id,
        ...FACTION_META[id],
        heroes: byFaction[id],
      }));
    }
    return [
      {
        id: factionTab,
        ...FACTION_META[factionTab],
        heroes: byFaction[factionTab],
      },
    ];
  }, [factionTab, byFaction]);

  return (
    <div className="gw-codex">
      {inspect && <HeroDetailModal prefab={inspect} onClose={() => setInspect(null)} />}

      <header className="gw-codex-head">
        <div className="gw-codex-head-text">
          <p className="gw-codex-kicker">Warlord archive</p>
          <h2 className="gw-codex-title">Hero Codex</h2>
          <p className="gw-codex-sub">
            {codexCount} GRUDGE warlords by faction. Scroll each hall sideways — click a card for
            lore, abilities, and showcase.
          </p>
        </div>
        <label className="gw-codex-search-wrap">
          <span className="gw-codex-search-label">Search</span>
          <input
            type="search"
            className="gw-codex-search"
            placeholder="Name, title, class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </header>

      <nav className="gw-codex-factions" aria-label="Faction halls">
        <button
          type="button"
          className={`gw-codex-ftab${factionTab === "all" ? " is-active" : ""}`}
          onClick={() => setFactionTab("all")}
        >
          All halls
          <span className="gw-codex-ftab-n">{PREFABS.length}</span>
        </button>
        {(FACTIONS as { id: string; name: string; color: string }[]).map((f) => {
          const id = f.id as Exclude<FactionTab, "all">;
          if (!FACTION_META[id]) return null;
          const n = byFaction[id]?.length ?? 0;
          return (
            <button
              key={f.id}
              type="button"
              className={`gw-codex-ftab${factionTab === id ? " is-active" : ""}`}
              style={{ ["--ftab-color" as string]: f.color }}
              onClick={() => setFactionTab(id)}
            >
              {f.name}
              <span className="gw-codex-ftab-n">{n}</span>
            </button>
          );
        })}
      </nav>

      <div className="gw-codex-halls">
        {halls.map((hall) => (
          <FactionHall
            key={hall.id}
            name={hall.name}
            color={hall.color}
            blurb={hall.blurb}
            heroes={hall.heroes}
            onOpen={setInspect}
          />
        ))}
        {halls.every((h) => h.heroes.length === 0) && (
          <p className="gw-codex-empty">No warlords match “{search}”.</p>
        )}
      </div>
    </div>
  );
}

function FactionHall({
  name,
  color,
  blurb,
  heroes,
  onOpen,
}: {
  name: string;
  color: string;
  blurb: string;
  heroes: PrefabCharacter[];
  onOpen: (p: PrefabCharacter) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    const step = Math.max(280, el.clientWidth * 0.75);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  if (heroes.length === 0) return null;

  return (
    <section className="gw-codex-hall" style={{ ["--hall-accent" as string]: color }}>
      <div className="gw-codex-hall-head">
        <div>
          <h3 className="gw-codex-hall-name">{name}</h3>
          <p className="gw-codex-hall-blurb">{blurb}</p>
        </div>
        <div className="gw-codex-hall-nav">
          <span className="gw-codex-hall-count">{heroes.length} warlords</span>
          <button type="button" className="gw-codex-nav-btn" onClick={() => scrollBy(-1)} aria-label="Scroll left">
            ‹
          </button>
          <button type="button" className="gw-codex-nav-btn" onClick={() => scrollBy(1)} aria-label="Scroll right">
            ›
          </button>
        </div>
      </div>

      <div className="gw-codex-rail-wrap">
        <div ref={railRef} className="gw-codex-rail" role="list">
          {heroes.map((p) => (
            <button
              key={p.id}
              type="button"
              className="gw-codex-tile"
              role="listitem"
              onClick={() => onOpen(p)}
            >
              <div className="gw-codex-tile-art-wrap">
                <img
                  className="gw-codex-tile-art"
                  src={resolvePortraitUrl(p.id)}
                  alt=""
                  loading="lazy"
                />
                <span className="gw-codex-tile-class">{p.classId}</span>
              </div>
              <div className="gw-codex-tile-body">
                <strong className="gw-codex-tile-name">{p.name}</strong>
                <span className="gw-codex-tile-title">{p.title}</span>
                <span className="gw-codex-tile-race">{p.raceId.replace(/-/g, " ")}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
