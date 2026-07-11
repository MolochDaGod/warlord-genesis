import { useSession } from "../../game/session";

export function AuthPanel() {
  const { user, loading, error, guest, signInWithStudio, signOut } =
    useSession();

  if (user) {
    return (
      <div className="gw-hub-body">
        <div className="gw-account-card">
          <div className="gw-account-name">
            {user.displayName || user.username}
          </div>
          <div className="gw-account-id" title="Grudge ID">
            {user.grudgeId}
          </div>
          <div className="gw-account-grid">
            <div>
              <span className="gw-account-k">Role</span>
              <span className="gw-account-v">{user.role}</span>
            </div>
            <div>
              <span className="gw-account-k">GBUX</span>
              <span className="gw-account-v">
                {Number(user.gbuxBalance).toLocaleString()}
              </span>
            </div>
          </div>
          {user.role === "guest" && (
            <p className="gw-account-hint">
              Guest progress stays on this device. Sign in with Grudge Studio to
              keep characters and unlocks across games.
            </p>
          )}
          <button
            type="button"
            className="gw-btn gw-btn-ghost"
            onClick={signOut}
            disabled={loading}
          >
            {loading ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gw-hub-body">
      <div className="gw-auth-intro">
        <p className="gw-auth-lead">
          Sign in with Grudge Studio for one Grudge ID across Warlord Genesis and
          the fleet. Characters, GBux, and progress travel with your account.
        </p>
      </div>

      {error && (
        <div className="gw-form-error" role="alert">
          {error}
        </div>
      )}

      <button
        className="gw-btn gw-btn-puter"
        type="button"
        onClick={signInWithStudio}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? "Opening Grudge ID…" : "Sign in with Grudge Studio"}
      </button>

      <div className="gw-or">or</div>
      <button
        type="button"
        className="gw-btn gw-btn-ghost"
        onClick={guest}
        disabled={loading}
      >
        Continue as guest
      </button>
    </div>
  );
}
