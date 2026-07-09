import { useMemo, useState } from "react";
import { PREFABS, type PrefabCharacter } from "@workspace/game-content";
import { allCodexHeroes, HERO_CODEX_ORIGIN } from "../../lib/heroCodex";
import { resolvePortraitUrl } from "../../lib/heroMedia";
import { CollectionFilters, type CollectionFilter } from "./CollectionFilters";
import { HeroDetailModal } from "./HeroDetailModal";
import "./collection.css";

/** Full canonical roster browser — Hearthstone-style codex grid from grudge-heros.puter.site. */
export function HeroCodexGrid() {
  const [filter, setFilter] = useState<CollectionFilter>("all");
  const [search, setSearch] = useState("");
  const [inspect, setInspect] = useState<PrefabCharacter | null>(null);
  const codexCount = allCodexHeroes().length;

  const prefabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PREFABS.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.title.toLowerCase().includes(q)) return false;
      if (filter === "crusade" || filter === "fabled" || filter === "legion") return p.faction === filter;
      if (filter === "owned" || filter === "locked") return true;
      return true;
    });
  }, [search, filter]);

  return (
    <div className="gw-collection gw-codex-grid">
      {inspect && <HeroDetailModal prefab={inspect} onClose={() => setInspect(null)} />}
      <header className="gw-collection-head">
        <div>
          <h2 className="gw-collection-title">Hero Codex</h2>
          <p className="gw-collection-sub">
            Canonical lore, abilities, and showcase reels for all {codexCount} GRUDGE warlords — synced from{" "}
            <a href={HERO_CODEX_ORIGIN} target="_blank" rel="noreferrer">grudge-heros.puter.site</a>.
            Tap a card for video showcase + in-character AI guide.
          </p>
        </div>
      </header>

      <CollectionFilters value={filter} onChange={setFilter} search={search} onSearch={setSearch} />

      <div className="gw-codex-roster">
        {prefabs.map((p) => (
          <button
            key={p.id}
            type="button"
            className="gw-codex-card"
            onClick={() => setInspect(p)}
          >
            <img
              className="gw-codex-card-art"
              src={resolvePortraitUrl(p.id)}
              alt={p.name}
              loading="lazy"
            />
            <div className="gw-codex-card-body">
              <span className="gw-codex-card-class">{p.classId}</span>
              <strong>{p.name}</strong>
              <span className="gw-codex-card-title">{p.title}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}