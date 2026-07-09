import { useEffect, useState } from "react";
import { useMeta } from "../../game/metaProgression";

export function PackOpenOverlay() {
  const lastMatchReward = useMeta((s) => s.lastMatchReward);
  const clearLastMatchReward = useMeta((s) => s.clearLastMatchReward);
  const [phase, setPhase] = useState<"hidden" | "tear" | "reveal" | "done">("hidden");
  const [visibleReward, setVisibleReward] = useState(lastMatchReward);

  useEffect(() => {
    if (!lastMatchReward) return;
    setVisibleReward(lastMatchReward);
    setPhase("tear");
    const t1 = setTimeout(() => setPhase("reveal"), 600);
    const t2 = setTimeout(() => setPhase("done"), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [lastMatchReward?.at]);

  if (!visibleReward || phase === "hidden") return null;

  const dismiss = () => {
    setPhase("hidden");
    setVisibleReward(null);
    clearLastMatchReward();
  };

  return (
    <div className={`gw-pack-overlay gw-pack-overlay--${phase}`} onClick={phase === "done" ? dismiss : undefined} role="presentation">
      <div className="gw-pack-stage" onClick={(e) => e.stopPropagation()}>
        {phase === "tear" && (
          <div className="gw-pack-box">
            <span className="gw-pack-label">OPENING PACK…</span>
          </div>
        )}
        {(phase === "reveal" || phase === "done") && (
          <div className="gw-pack-reveal">
            {visibleReward.gbux !== 0 && (
              <div className="gw-pack-gbux">
                {visibleReward.gbux > 0 ? "+" : ""}
                {visibleReward.gbux} GBUX
              </div>
            )}
            <div className="gw-pack-cards">
              {visibleReward.shardGrants.map((g, i) => (
                <div key={`${g.id}-${i}`} className="gw-pack-card" style={{ animationDelay: `${i * 0.12}s` }}>
                  <span className="gw-pack-card-kind">{g.kind === "character" ? "Warlord" : "Lane Guard"}</span>
                  <span className="gw-pack-card-name">{g.label}</span>
                  <span className="gw-pack-card-shard">+1 shard</span>
                </div>
              ))}
            </div>
            {phase === "done" && (
              <button type="button" className="gw-btn" onClick={dismiss}>
                COLLECT
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}