import { useMemo, useState } from "react";
import { PREFABS, FACTIONS, type PrefabCharacter } from "@workspace/game-content";
import {
  DAILY_PACK,
  UPGRADE_PACK_COST,
  useMeta,
} from "../../game/metaProgression";
import { CharacterCard } from "./CharacterCard";
import { CollectionFilters, type CollectionFilter } from "./CollectionFilters";
import { HeroDetailModal } from "./HeroDetailModal";
import "./collection.css";

export function CollectionHub() {
  const gbux = useMeta((s) => s.gbux);
  const lastDailyClaim = useMeta((s) => s.lastDailyClaim);
  const claimDailyPack = useMeta((s) => s.claimDailyPack);
  const buyUpgradePack = useMeta((s) => s.buyUpgradePack);
  const cards = useMeta((s) => s.cards);
  const isCharacterUnlocked = useMeta((s) => s.isCharacterUnlocked);
  const [filter, setFilter] = useState<CollectionFilter>("all");
  const [search, setSearch] = useState("");
  const [inspect, setInspect] = useState<PrefabCharacter | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const dailyReady = lastDailyClaim !== today;

  const ownedCount = useMemo(
    () => cards.filter((c) => c.kind === "character" && c.level > 0).length,
    [cards],
  );

  const filteredPrefabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PREFABS.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.title.toLowerCase().includes(q)) return false;
      if (filter === "owned") return isCharacterUnlocked(p.id);
      if (filter === "locked") return !isCharacterUnlocked(p.id);
      if (filter === "crusade" || filter === "fabled" || filter === "legion") return p.faction === filter;
      return true;
    });
  }, [search, filter, isCharacterUnlocked]);

  return (
    <div className="gw-collection">
      {inspect && <HeroDetailModal prefab={inspect} onClose={() => setInspect(null)} />}
      <header className="gw-collection-head">
        <div>
          <h2 className="gw-collection-title">War Chest</h2>
          <p className="gw-collection-sub">
            Win battles and claim daily packs for GBUX and upgrade shards. Ten shards unlock a
            hero or lane guard; ten more raise their gear tier (T1–T8).
          </p>
        </div>
        <div className="gw-collection-gbux">
          <span className="gw-collection-gbux-val">{gbux}</span>
          <span className="gw-collection-gbux-label">GBUX</span>
        </div>
      </header>

      <div className="gw-collection-actions">
        <button
          type="button"
          className="gw-btn"
          disabled={!dailyReady}
          onClick={() => claimDailyPack()}
        >
          {dailyReady
            ? `DAILY PACK (+${DAILY_PACK.gbux} GBUX · ${DAILY_PACK.shards} shards)`
            : "DAILY PACK CLAIMED"}
        </button>
        <button
          type="button"
          className="gw-btn gw-btn-ghost"
          disabled={gbux < UPGRADE_PACK_COST}
          onClick={() => buyUpgradePack()}
        >
          UPGRADE PACK ({UPGRADE_PACK_COST} GBUX · 3 shards)
        </button>
      </div>

      <CollectionFilters value={filter} onChange={setFilter} search={search} onSearch={setSearch} />

      <div className="gw-collection-stats">
        <span>{ownedCount} / {PREFABS.length} warlords unlocked</span>
        <a href="https://grudge-heros.puter.site/" target="_blank" rel="noreferrer" className="gw-collection-codex-link">
          Canonical Hero Codex ↗
        </a>
      </div>

      <div className="gw-collection-grid">
        {filteredPrefabs.map((p) => (
          <CharacterCard
            key={p.id}
            prefab={p}
            locked={!isCharacterUnlocked(p.id)}
            onInspect={() => setInspect(p)}
          />
        ))}
      </div>
    </div>
  );
}