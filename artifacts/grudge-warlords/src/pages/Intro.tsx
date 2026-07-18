import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUI } from "../game/ui";
import { useSession } from "../game/session";
import { ICONS } from "../components/ui/icons";
import { bootEngine, getEngine } from "../engine/boot";
import { WARLORD_MANIFEST } from "../engine/warlordManifest";
import { DEPLOY_PATH } from "../lib/deployRoutes";
import { isOpenLaunch } from "../lib/openLaunch";
import { hydrateOpenLaunchWarlord } from "../lib/fleetCharacterHydrate";

const PIPELINE_BADGES = [
  { id: "id", label: "Grudge ID", detail: "id.grudge-studio.com — fleet auth" },
  { id: "pg", label: "Railway Postgres", detail: "Characters · account · wallet · Treaty" },
  { id: "r2", label: "R2 CDN", detail: "GRUDGE6 meshes · baked anims" },
] as const;

export function Intro() {
  const navigate = useNavigate();
  const openHub = useUI((s) => s.openHub);
  const user = useSession((s) => s.user);
  const [booting, setBooting] = useState(true);
  const [cdnOk, setCdnOk] = useState(false);

  useEffect(() => {
    bootEngine().then((s) => {
      setCdnOk(s.cdnReachable);
      setBooting(false);
    });
  }, []);

  // Open / charactersgrudox → Warcamp with handoff warlord (never Ruins Brawler)
  useEffect(() => {
    if (!isOpenLaunch()) return;
    let cancelled = false;
    void (async () => {
      await hydrateOpenLaunchWarlord();
      if (!cancelled) navigate("/lobby", { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const eng = getEngine();

  return (
    <div className="gw-screen gw-intro">
      <div className="gw-intro-bg" aria-hidden />
      <div className="gw-screen-inner gw-intro-inner">
        <div className="gw-intro-prelude">
          <span className="gw-brand-sub">Grudge Nexus · Warlord Genesis</span>
          <div className="gw-intro-badges">
            {PIPELINE_BADGES.map((b) => (
              <span key={b.id} className="gw-intro-badge" title={b.detail}>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <div className="gw-brand gw-intro-brand">
          <h1 className="gw-brand-title">
            GRUDGE<span>WARLORDS</span>
          </h1>
          <p className="gw-intro-tagline">
            Command three lanes. Raise tiered warbands. Siege with cannon, ballista, and arcane turrets.
          </p>
        </div>

        <div className="gw-intro-stats">
          <div className="gw-intro-stat-col">
            <span className="gw-intro-stat-label">Melee Tiers</span>
            {WARLORD_MANIFEST.meleeTiers.map((t) => (
              <span key={t.id} className="gw-intro-stat-row" style={{ color: t.tierColor }}>
                T{t.tier} {t.name}
              </span>
            ))}
          </div>
          <div className="gw-intro-stat-col">
            <span className="gw-intro-stat-label">Ranged Tiers</span>
            {WARLORD_MANIFEST.rangedTiers.map((t) => (
              <span key={t.id} className="gw-intro-stat-row" style={{ color: t.tierColor }}>
                T{t.tier} {t.name}
              </span>
            ))}
          </div>
          <div className="gw-intro-stat-col">
            <span className="gw-intro-stat-label">Engine</span>
            <span className="gw-intro-stat-row">
              {booting ? "Booting…" : eng.ready ? `v${WARLORD_MANIFEST.version}` : "Fallback"}
            </span>
            <span className="gw-intro-stat-row">{cdnOk ? "R2 CDN online" : "Local assets"}</span>
            <span className="gw-intro-stat-row">
              {user ? `Signed in · ${user.displayName || user.username}` : "Guest / sign in via hub"}
            </span>
          </div>
        </div>

        <button className="gw-btn gw-intro-cta" onClick={() => navigate("/lobby")}>
          ENTER THE WARCAMP
        </button>
        <button
          className="gw-btn gw-btn-ghost gw-intro-cta-secondary"
          onClick={() => navigate("/play?skirmish=1")}
        >
          QUICK BATTLE
        </button>
        <button
          className="gw-btn gw-btn-ghost gw-intro-cta-secondary"
          onClick={() => navigate("/mp")}
        >
          WAGE WAR ONLINE
        </button>
        <button
          type="button"
          className="gw-btn gw-btn-ghost gw-btn-mini"
          style={{ marginTop: 8 }}
          onClick={() => navigate(DEPLOY_PATH)}
        >
          MARCH ORDERS ONLY
        </button>

        <div className="gw-menu-actions">
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("account")}>
            <img className="gw-btn-icon" src={ICONS.fist} alt="" draggable={false} />
            {user ? `ACCOUNT: ${user.displayName || user.username}` : "ACCOUNT / SIGN IN"}
          </button>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("wallet")}>
            <img className="gw-btn-icon" src={ICONS.cup} alt="" draggable={false} />
            WALLET
          </button>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("treaty")}>
            <img className="gw-btn-icon" src={ICONS.chat} alt="" draggable={false} />
            TREATY
          </button>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("codex")}>
            <img className="gw-btn-icon" src={ICONS.chest} alt="" draggable={false} />
            CODEX
          </button>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("about")}>
            <img className="gw-btn-icon" src={ICONS.hammer} alt="" draggable={false} />
            FLEET
          </button>
        </div>
        <span className="gw-hint">
          3D warcamp · Railway account SSOT · Grudge ID · Treaty · Wallet · manifest v{WARLORD_MANIFEST.version}
        </span>
      </div>
    </div>
  );
}