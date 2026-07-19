import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUI } from "../game/ui";
import { useSession } from "../game/session";
import { useMeta } from "../game/metaProgression";
import { ICONS } from "../components/ui/icons";
import { bootEngine, getEngine } from "../engine/boot";
import { WARLORD_MANIFEST } from "../engine/warlordManifest";
import {
  loginWithRedirect,
  captureRedirectToken,
  getStudioToken,
} from "../lib/grudgeStudio";
import {
  PRODUCTION_SEASON,
  PRODUCTION_SEASON_LABEL,
} from "../lib/productionSeason";

const PIPELINE_BADGES = [
  { id: "id", label: "Grudge ID", detail: "id.grudge-studio.com — fleet auth" },
  { id: "pg", label: "Railway Postgres", detail: "Characters · account · progression" },
  { id: "r2", label: "R2 CDN", detail: "GRUDGE6 meshes · baked anims" },
] as const;

function postLoginPath(): string {
  const meta = useMeta.getState();
  if (!meta.factionChosen) return "/onboarding/faction";
  if (!meta.onboardingDone) return "/onboarding/warlord";
  return "/lobby";
}

export function Intro() {
  const navigate = useNavigate();
  const openHub = useUI((s) => s.openHub);
  const user = useSession((s) => s.user);
  const loading = useSession((s) => s.loading);
  const error = useSession((s) => s.error);
  const signInWithStudio = useSession((s) => s.signInWithStudio);
  const guest = useSession((s) => s.guest);
  const restore = useSession((s) => s.restore);
  const clearError = useSession((s) => s.clearError);
  const [booting, setBooting] = useState(true);
  const [cdnOk, setCdnOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    captureRedirectToken();
    bootEngine().then((s) => {
      setCdnOk(s.cdnReachable);
      setBooting(false);
    });
    void restore();
  }, [restore]);

  const eng = getEngine();

  const afterAuth = () => {
    navigate(postLoginPath());
  };

  const onPopupLogin = async () => {
    clearError();
    setBusy(true);
    try {
      await signInWithStudio();
      afterAuth();
    } catch {
      // Popup blocked or failed — fall back to full-page SSO
      loginWithRedirect("/auth/callback");
    } finally {
      setBusy(false);
    }
  };

  const onRedirectLogin = () => {
    clearError();
    loginWithRedirect("/auth/callback");
  };

  const onGuest = async () => {
    clearError();
    setBusy(true);
    try {
      await guest();
      afterAuth();
    } finally {
      setBusy(false);
    }
  };

  const onContinue = () => {
    if (user || getStudioToken()) {
      afterAuth();
      return;
    }
    void onPopupLogin();
  };

  return (
    <div className="gw-screen gw-intro">
      <div className="gw-intro-bg" aria-hidden />
      <div className="gw-screen-inner gw-intro-inner">
        <div className="gw-intro-prelude">
          <span className="gw-brand-sub">{PRODUCTION_SEASON_LABEL}</span>
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
            Fresh production season. Sign in with Grudge ID, choose your faction, then command
            three lanes with unlocks, missions, and upgrades.
          </p>
        </div>

        <p
          className="gw-intro-engine-line"
          style={{ color: "var(--gw-muted)", fontSize: 12, letterSpacing: "0.08em" }}
        >
          {booting
            ? "Booting engine…"
            : eng.ready
              ? `Engine v${WARLORD_MANIFEST.version} · ${cdnOk ? "R2 CDN ready" : "local assets"}`
              : "Engine fallback"}
          {user ? ` · ${user.displayName || user.username}` : " · Not signed in"}
          {` · ${PRODUCTION_SEASON}`}
        </p>

        {error && (
          <p style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }} role="alert">
            {error}
          </p>
        )}

        <button
          className="gw-btn gw-intro-cta"
          disabled={busy || loading}
          onClick={() => void onContinue()}
        >
          {user || getStudioToken()
            ? "CONTINUE TO FACTION / WARCAMP"
            : busy
              ? "SIGNING IN…"
              : "SIGN IN · GRUDGE ID"}
        </button>

        <div
          className="gw-menu-actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginTop: 12,
          }}
        >
          {!user && (
            <>
              <button
                type="button"
                className="gw-btn gw-btn-ghost gw-btn-mini"
                disabled={busy}
                onClick={() => void onPopupLogin()}
              >
                Popup sign-in
              </button>
              <button
                type="button"
                className="gw-btn gw-btn-ghost gw-btn-mini"
                disabled={busy}
                onClick={onRedirectLogin}
              >
                Full-page sign-in
              </button>
              <button
                type="button"
                className="gw-btn gw-btn-ghost gw-btn-mini"
                disabled={busy}
                onClick={() => void onGuest()}
              >
                Guest (local season)
              </button>
            </>
          )}
          <button type="button" className="gw-btn gw-btn-ghost gw-btn-mini" onClick={() => navigate("/mp")}>
            ONLINE
          </button>
          <button
            type="button"
            className="gw-btn gw-btn-ghost gw-btn-mini"
            onClick={() => openHub("account")}
          >
            <img className="gw-btn-icon" src={ICONS.fist} alt="" draggable={false} />
            ACCOUNT
          </button>
          <button
            type="button"
            className="gw-btn gw-btn-ghost gw-btn-mini"
            onClick={() => openHub("about")}
          >
            FLEET
          </button>
        </div>
        <span className="gw-hint">
          After login: Faction → Warlord → Warcamp. Missions & dungeons live under Island Missions.
        </span>
      </div>
    </div>
  );
}
