import { useEffect, useMemo, useState } from "react";
import {
  DATASETS,
  type DatasetKey,
  type GrudgeDataset,
  type GrudgeItem,
  flattenItems,
  getTierColor,
} from "../../lib/grudgeData";
import { ICONS } from "./icons";

export function Codex() {
  const [active, setActive] = useState<DatasetKey>("weapons");
  const [cache, setCache] = useState<Partial<Record<DatasetKey, GrudgeDataset>>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (cache[active]) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    import("../../lib/grudgeData")
      .then((m) => m.loadDataset(active))
      .then((data) => {
        if (!cancelled) setCache((c) => ({ ...c, [active]: data }));
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, cache]);

  const items = useMemo<GrudgeItem[]>(() => {
    const data = cache[active];
    if (!data) return [];
    const all = flattenItems(data);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (it) =>
        it.name?.toLowerCase().includes(q) ||
        it.category?.toLowerCase().includes(q) ||
        it.type?.toLowerCase().includes(q),
    );
  }, [cache, active, query]);

  return (
    <div className="gw-hub-body gw-codex">
      <div className="gw-codex-tabs">
        {DATASETS.map((d) => (
          <button
            key={d.key}
            className={d.key === active ? "active" : ""}
            onClick={() => setActive(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="gw-codex-searchbar">
        <img className="gw-codex-filter-icon" src={ICONS.tune} alt="" draggable={false} />
        <input
          className="gw-codex-search"
          placeholder="Search by name, category, type..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <div className="gw-codex-status">Loading {active}...</div>}
      {error && <div className="gw-form-error">{error}</div>}
      {!loading && !error && (
        <div className="gw-codex-count">{items.length} entries</div>
      )}

      <div className="gw-codex-grid">
        {items.map((it) => {
          const tier = getTierColor(it.tier);
          return (
            <div className="gw-codex-card" key={it.id}>
              <div
                className="gw-codex-tier"
                style={{ background: tier.hex }}
                title={`Tier ${it.tier ?? 1} - ${tier.label}`}
              />
              <div className="gw-codex-info">
                <div className="gw-codex-name">{it.name}</div>
                <div className="gw-codex-meta">
                  <span style={{ color: tier.hex }}>{tier.label}</span>
                  {it.category && <span>{it.category}</span>}
                  {it.type && <span>{it.type}</span>}
                </div>
                {it.lore && <div className="gw-codex-lore">{it.lore}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
