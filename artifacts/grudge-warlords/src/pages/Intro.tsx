import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUI } from "../game/ui";
import { useSession } from "../game/session";
import { ICONS } from "../components/ui/icons";
import { bootEngine, getEngine } from "../engine/boot";
import { WARLORD_MANIFEST } from "../engine/warlordManifest";
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

        <p className="gw-intro-engine-line" style={{ color: "var(--gw-muted)", fontSize: 12, letterSpacing: "0.08em" }}>
          {booting
            ? "Booting engine…"
            : eng.ready
              ? `Engine v${WARLORD_MANIFEST.version} · ${cdnOk ? "R2 CDN ready" : "local assets"}`
              : "Engine fallback"}
          {user ? ` · ${user.displayName || user.username}` : " · Guest"}
        </p>

        <button className="gw-btn gw-intro-cta" onClick={() => navigate("/lobby")}>
          ENTER THE WARCAMP
        </button>
        <button
          className="gw-btn gw-btn-ghost gw-intro-cta-secondary"
          onClick={() => navigate("/play?skirmish=1")}
        >
          QUICK BATTLE
        </button>
        <div className="gw-menu-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => navigate("/mp")}>
            ONLINE
          </button>
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("account")}>
            <img className="gw-btn-icon" src={ICONS.fist} alt="" draggable={false} />
            {user ? user.displayName || user.username : "SIGN IN"}
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