import { useNavigate } from "react-router-dom";
import { useUI } from "../game/ui";
import { useSession } from "../game/session";
import { ICONS } from "../components/ui/icons";

export function Landing() {
  const navigate = useNavigate();
  const openHub = useUI((s) => s.openHub);
  const user = useSession((s) => s.user);

  return (
    <div className="gw-screen gw-landing">
      <div className="gw-screen-inner">
        <div className="gw-brand">
          <span className="gw-brand-sub">A War of Banners</span>
          <h1 className="gw-brand-title">
            GRUDGE<span>WARLORDS</span>
          </h1>
        </div>
        <p className="gw-intro">
          Lead your warband against a rival host across three lanes. Summon soldiers, command them
          into battle, raise sentries to hold the line — and raze the enemy Citadel before yours falls.
        </p>
        <button className="gw-btn gw-landing-cta" onClick={() => navigate("/lobby")}>
          ENTER THE WARCAMP
        </button>
        <button
          className="gw-btn gw-btn-ghost gw-landing-cta"
          style={{ marginTop: 10 }}
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
        <span className="gw-hint">Single-player · 3D MOBA / RTS</span>
      </div>
    </div>
  );
}
