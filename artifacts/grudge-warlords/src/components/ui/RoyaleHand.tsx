/**
 * Clash Royale–style card hand + elixir bar for royale map battles.
 */
import { useGame } from "../../game/store";
import { ROYALE, type RoyaleCard } from "../../game/royale";
import "./royale.css";

export function RoyaleHand() {
  const phase = useGame((s) => s.phase);
  const mapSize = useGame((s) => s.mapSize);
  const elixir = useGame((s) => s.elixir);
  const hand = useGame((s) => s.royaleHand);
  const selected = useGame((s) => s.royaleSelected);
  const selectRoyaleCard = useGame((s) => s.selectRoyaleCard);
  const doubleElixir = useGame((s) => s.royaleDoubleElixir);

  if (phase !== "battle" || mapSize !== "royale") return null;

  const fill = Math.min(1, elixir / ROYALE.maxElixir);

  return (
    <div className="gw-royale-hand" role="toolbar" aria-label="Deploy cards">
      <div className="gw-royale-elixir">
        <div className="gw-royale-elixir-track">
          <div className="gw-royale-elixir-fill" style={{ width: `${fill * 100}%` }} />
        </div>
        <span className="gw-royale-elixir-label">
          💧 {elixir.toFixed(1)} / {ROYALE.maxElixir}
          {doubleElixir ? " · 2×" : ""}
        </span>
      </div>
      <div className="gw-royale-cards">
        {hand.map((card: RoyaleCard, i: number) => {
          const can = elixir + 1e-3 >= card.elixir;
          const active = selected === i;
          return (
            <button
              key={`${card.id}-${i}`}
              type="button"
              className={`gw-royale-card${active ? " is-active" : ""}${can ? "" : " is-locked"}`}
              disabled={!can}
              title={`${card.name} · ${card.elixir} elixir — ${card.blurb}`}
              onClick={() => selectRoyaleCard(active ? null : i)}
            >
              <span className="gw-royale-card-glyph">{card.glyph}</span>
              <span className="gw-royale-card-name">{card.name}</span>
              <span className="gw-royale-card-cost">{card.elixir}</span>
              {card.count > 1 && (
                <span className="gw-royale-card-count">×{card.count}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="gw-royale-hint">
        {selected != null
          ? "Tap your half of the arena to deploy"
          : "Select a card · deploy on your side of the river"}
      </p>
    </div>
  );
}
