import { useUI, type HubTab } from "../../game/ui";
import { useSession } from "../../game/session";
import { AuthPanel } from "./AuthPanel";
import { WalletPanel } from "./WalletPanel";
import { TreatyPanel } from "./TreatyPanel";
import { FleetAboutPanel } from "./FleetAboutPanel";
import { Codex } from "./Codex";
import { AIWorker } from "./AIWorker";
import { ICONS } from "./icons";

const TABS: { key: HubTab; label: string; icon: string }[] = [
  { key: "account", label: "ACCOUNT", icon: ICONS.fist },
  { key: "wallet", label: "WALLET", icon: ICONS.cup },
  { key: "treaty", label: "TREATY", icon: ICONS.chat },
  { key: "codex", label: "CODEX", icon: ICONS.chest },
  { key: "ai", label: "AI", icon: ICONS.lab },
  { key: "about", label: "FLEET", icon: ICONS.hammer },
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
                type="button"
                className={t.key === hubTab ? "active" : ""}
                onClick={() => setHubTab(t.key)}
              >
                <img className="gw-tab-icon" src={t.icon} alt="" draggable={false} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="gw-hub-right">
            {user && <span className="gw-hub-user">{user.displayName || user.username}</span>}
            <button type="button" className="gw-hub-close" onClick={closeHub} aria-label="Close">
              X
            </button>
          </div>
        </header>

        {hubTab === "account" && <AuthPanel />}
        {hubTab === "wallet" && <WalletPanel />}
        {hubTab === "treaty" && <TreatyPanel />}
        {hubTab === "codex" && <Codex />}
        {hubTab === "ai" && <AIWorker />}
        {hubTab === "about" && <FleetAboutPanel />}
      </div>
    </div>
  );
}
