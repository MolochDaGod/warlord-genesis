import type { CapabilityReport } from "../../lib/capabilities";
import { BUILD_DEPENDENCY_TREE, RUNTIME_DEPENDENCY_TREE } from "../../lib/capabilities";

export function CapabilityGate({
  report,
  onRetry,
}: {
  report: CapabilityReport;
  onRetry?: () => void;
}) {
  return (
    <div className="gw-screen gw-play-gate">
      <div className="gw-play-gate-inner" style={{ maxWidth: 560, textAlign: "left" }}>
        <h2 className="gw-engage-title">System check failed</h2>
        <p className="gw-hint">
          Warlord Genesis needs a modern browser with hardware-accelerated 3D. Fix the blockers
          below, then reload.
        </p>

        {report.blockers.length > 0 && (
          <ul className="gw-hint" style={{ margin: "12px 0", paddingLeft: 18 }}>
            {report.blockers.map((b) => (
              <li key={b} style={{ color: "#ff8a80", marginBottom: 6 }}>
                {b}
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 16 }}>
          <span className="gw-deploy-k">Browser capabilities</span>
          <div className="gw-controls-grid" style={{ gridTemplateColumns: "1fr", gap: 6, marginTop: 8 }}>
            {report.checks
              .filter((c) => c.severity !== "build")
              .map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 13,
                    opacity: c.ok ? 0.85 : 1,
                    color: c.ok ? "#9ecfb0" : c.severity === "required" ? "#ff8a80" : "#e0c36a",
                  }}
                >
                  <span>
                    {c.ok ? "✓" : "✗"} {c.label}{" "}
                    <span style={{ opacity: 0.6 }}>({c.severity})</span>
                  </span>
                  <span style={{ opacity: 0.75, textAlign: "right" }}>{c.detail}</span>
                </div>
              ))}
          </div>
        </div>

        <details style={{ marginTop: 18 }}>
          <summary className="gw-hint" style={{ cursor: "pointer" }}>
            Runtime dependency tree
          </summary>
          <ul className="gw-hint" style={{ paddingLeft: 18, marginTop: 8 }}>
            {RUNTIME_DEPENDENCY_TREE.map((d) => (
              <li key={d.name} style={{ marginBottom: 6 }}>
                <strong>{d.name}</strong> — {d.role}
                <br />
                <span style={{ opacity: 0.7 }}>needs: {d.pre.join(", ")}</span>
              </li>
            ))}
          </ul>
        </details>

        <details style={{ marginTop: 10 }}>
          <summary className="gw-hint" style={{ cursor: "pointer" }}>
            Build / deploy dependencies (Node — not in browser)
          </summary>
          <ul className="gw-hint" style={{ paddingLeft: 18, marginTop: 8 }}>
            {BUILD_DEPENDENCY_TREE.map((d) => (
              <li key={d.name} style={{ marginBottom: 4 }}>
                <strong>{d.name}</strong> — {d.role}
              </li>
            ))}
          </ul>
        </details>

        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <button type="button" className="gw-btn" onClick={() => window.location.reload()}>
            RELOAD
          </button>
          {onRetry && (
            <button type="button" className="gw-btn gw-btn-ghost" onClick={onRetry}>
              RE-CHECK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
