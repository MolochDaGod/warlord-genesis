import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUI } from "../game/ui";
import { useSession } from "../game/session";
import { ICONS } from "../components/ui/icons";
import { bootEngine, getEngine } from "../engine/boot";
import { WARLORD_MANIFEST } from "../engine/warlordManifest";

const PIPELINE_BADGES = [
  { id: "r2", label: "Cloudflare R2", detail: "Units · textures · baked anims" },
  { id: "d1", label: "D1 Heroes", detail: "Canonical warlord roster" },
  { id: "eng", label: "Grudge Engine", detail: "Manifest-driven stats & mounts" },
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
          </div>
        </div>

        <button className="gw-btn gw-intro-cta" onClick={() => navigate("/lobby")}>
          ENTER THE WARCAMP
        </button>
        <button
          className="gw-btn gw-btn-ghost gw-intro-cta-secondary"
          onClick={() => navigate("/mp")}
        >
          WAGE WAR ONLINE
        </button>

        <div className="gw-menu-actions">
          <button className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("account")}>
            <img className="gw-btn-icon" src={ICONS.fist} alt="" draggable={false} />
            {user ? `BANNER: ${user.displayName || user.username}` : "SIGN IN / GUEST"}
          </button>
          <button className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("codex")}>
            <img className="gw-btn-icon" src={ICONS.chest} alt="" draggable={false} />
            CODEX
          </button>
          <button className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("ai")}>
            <img className="gw-btn-icon" src={ICONS.chat} alt="" draggable={false} />
            WAR COUNCIL
          </button>
        </div>
        <span className="gw-hint">3D MOBA / RTS · Grudge Engine manifest v{WARLORD_MANIFEST.version}</span>
      </div>
    </div>
  );
}