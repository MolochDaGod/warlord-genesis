import type { FactionId } from "@workspace/game-content";

export type CollectionFilter = "all" | "owned" | "locked" | FactionId;

interface CollectionFiltersProps {
  value: CollectionFilter;
  onChange: (v: CollectionFilter) => void;
  search: string;
  onSearch: (q: string) => void;
}

export function CollectionFilters({ value, onChange, search, onSearch }: CollectionFiltersProps) {
  const opts: Array<{ id: CollectionFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "owned", label: "Owned" },
    { id: "locked", label: "Locked" },
    { id: "crusade", label: "Crusade" },
    { id: "fabled", label: "Fabled" },
    { id: "legion", label: "Legion" },
  ];

  return (
    <div className="gw-collection-filters">
      <input
        type="search"
        className="gw-collection-search"
        placeholder="Search warlords…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="gw-collection-filter-row">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`gw-lobby-tab${value === o.id ? " is-active" : ""}`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}