/**
 * Gate routes behind session + faction/warlord onboarding.
 */
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../../game/session";
import { useMeta } from "../../game/metaProgression";
import { getStudioToken } from "../../lib/grudgeStudio";

export function RequireSession({
  children,
  allowGuest = true,
}: {
  children: React.ReactNode;
  allowGuest?: boolean;
}) {
  const location = useLocation();
  const user = useSession((s) => s.user);
  const loading = useSession((s) => s.loading);
  const restore = useSession((s) => s.restore);
  const factionChosen = useMeta((s) => s.factionChosen);
  const onboardingDone = useMeta((s) => s.onboardingDone);

  useEffect(() => {
    if (!user && getStudioToken()) void restore();
  }, [user, restore]);

  if (loading) {
    return (
      <div className="gw-screen gw-intro">
        <div className="gw-screen-inner" style={{ textAlign: "center" }}>
          <p>Loading session…</p>
        </div>
      </div>
    );
  }

  const authed = Boolean(user || getStudioToken());
  if (!authed && !allowGuest) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // Guests still must pick faction for this production season
  if (!factionChosen && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding/faction" replace />;
  }
  if (
    factionChosen &&
    !onboardingDone &&
    !location.pathname.startsWith("/onboarding")
  ) {
    return <Navigate to="/onboarding/warlord" replace />;
  }

  return <>{children}</>;
}
