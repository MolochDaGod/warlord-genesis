/**
 * SSO return landing — store token, restore session, route to faction select or lobby.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { captureRedirectToken } from "../lib/grudgeStudio";
import { useSession } from "../game/session";
import { useMeta } from "../game/metaProgression";
import { PRODUCTION_SEASON_LABEL } from "../lib/productionSeason";

export function AuthCallback() {
  const navigate = useNavigate();
  const restore = useSession((s) => s.restore);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    captureRedirectToken();
    let cancelled = false;
    (async () => {
      try {
        await restore();
        if (cancelled) return;
        const user = useSession.getState().user;
        if (!user) {
          setErr("Sign-in did not complete. Please try again.");
          return;
        }
        const meta = useMeta.getState();
        if (!meta.factionChosen) {
          navigate("/onboarding/faction", { replace: true });
        } else if (!meta.onboardingDone) {
          navigate("/onboarding/warlord", { replace: true });
        } else {
          navigate("/lobby", { replace: true });
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Auth failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, restore]);

  return (
    <div className="gw-screen gw-intro">
      <div className="gw-screen-inner" style={{ textAlign: "center" }}>
        <p className="gw-brand-sub">{PRODUCTION_SEASON_LABEL}</p>
        <h1 className="gw-brand-title" style={{ fontSize: "1.6rem" }}>
          {err ? "Sign-in issue" : "Securing session…"}
        </h1>
        {err ? (
          <>
            <p style={{ opacity: 0.8 }}>{err}</p>
            <button type="button" className="gw-btn" onClick={() => navigate("/")}>
              Back to title
            </button>
          </>
        ) : (
          <p style={{ opacity: 0.7 }}>Accepting Grudge ID token…</p>
        )}
      </div>
    </div>
  );
}
