import { useNavigate } from "react-router-dom";
import { useUI } from "../game/ui";
import { useSession } from "../game/session";
import { ICONS } from "../components/ui/icons";
import { sailAethermoorUrl, GRUDGE_FLEET_URLS } from "../lib/fleetUrls";
import { getStudioToken } from "../lib/grudgeStudio";
import { DEPLOY_PATH } from "../lib/deployRoutes";

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
        <button className="gw-btn gw-landing-cta" onClick={() => navigate(DEPLOY_PATH)}>
          ENTER THE WARCAMP
        </button>
        <button
          className="gw-btn gw-btn-ghost gw-landing-cta"
          style={{ marginTop: 10 }}
          onClick={() => navigate("/mp")}
        >
          WAGE WAR ONLINE
        </button>
        <a
          className="gw-btn gw-btn-ghost gw-landing-cta"
          style={{ marginTop: 10, display: "inline-flex", justifyContent: "center", textDecoration: "none" }}
          href={sailAethermoorUrl(getStudioToken())}
          target="_blank"
          rel="noreferrer"
        >
          SAIL AETHERMOOR
        </a>
        <a
          className="gw-btn gw-btn-ghost gw-btn-mini"
          style={{ marginTop: 8, display: "inline-flex", textDecoration: "none" }}
          href={`${GRUDGE_FLEET_URLS.water}/barracks`}
          target="_blank"
          rel="noreferrer"
        >
          BARRACKS STUDIO
        </a>
        <div className="gw-menu-actions">
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => openHub("account")}>
            <img className="gw-btn-icon" src={ICONS.fist} alt="" draggable={false} />
            {user ? `ACCOUNT: ${user.displayName || user.username}` : "ACCOUNT"}
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
        </div>
        <span className="gw-hint">Railway account SSOT · Grudge ID · Treaty · Wallet · 3D warcamp</span>
      </div>
    </div>
  );
}
