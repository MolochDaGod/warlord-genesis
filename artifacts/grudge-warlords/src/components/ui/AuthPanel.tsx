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
          <div className="gw-account-id">{user.grudgeId}</div>
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
              You are playing as a guest. Sign in with Grudge Studio to keep your
              progress across devices.
            </p>
          )}
          <button className="gw-btn gw-btn-ghost" onClick={signOut}>
            SIGN OUT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gw-hub-body">
      <div className="gw-auth-intro">
        <p className="gw-auth-lead">
          Sign in with Grudge Studio to claim your Grudge ID. Your account and
          progress are scoped to your Grudge Studio identity.
        </p>
      </div>

      {error && <div className="gw-form-error">{error}</div>}

      <button
        className="gw-btn gw-btn-puter"
        type="button"
        onClick={signInWithStudio}
        disabled={loading}
      >
        {loading ? "WORKING..." : "SIGN IN WITH GRUDGE STUDIO"}
      </button>

      <div className="gw-or">or</div>
      <button className="gw-btn gw-btn-ghost" onClick={guest} disabled={loading}>
        CONTINUE AS GUEST
      </button>
    </div>
  );
}
