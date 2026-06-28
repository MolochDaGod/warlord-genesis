import { useUI, type HubTab } from "../../game/ui";
import { useSession } from "../../game/session";
import { AuthPanel } from "./AuthPanel";
import { Codex } from "./Codex";
import { AIWorker } from "./AIWorker";
import { ICONS } from "./icons";

const TABS: { key: HubTab; label: string; icon: string }[] = [
  { key: "account", label: "ACCOUNT", icon: ICONS.fist },
  { key: "codex", label: "CODEX", icon: ICONS.chest },
  { key: "ai", label: "AI WORKER", icon: ICONS.chat },
];

export function GrudgeHub() {
  const { hubOpen, hubTab, setHubTab, closeHub } = useUI();
  const user = useSession((s) => s.user);

  if (!hubOpen) return null;

  return (
    <div className="gw-hub-overlay" onClick={closeHub}>
      <div className="gw-hub" onClick={(e) => e.stopPropagation()}>
        <header className="gw-hub-header">
          <div className="gw-hub-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={t.key === hubTab ? "active" : ""}
                onClick={() => setHubTab(t.key)}
              >
                <img className="gw-tab-icon" src={t.icon} alt="" draggable={false} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="gw-hub-right">
            {user && (
              <span className="gw-hub-user">{user.displayName || user.username}</span>
            )}
            <button className="gw-hub-close" onClick={closeHub} aria-label="Close">
              X
            </button>
          </div>
        </header>

        {hubTab === "account" && <AuthPanel />}
        {hubTab === "codex" && <Codex />}
        {hubTab === "ai" && <AIWorker />}
      </div>
    </div>
  );
}
