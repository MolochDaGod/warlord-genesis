import { useEffect, useState } from "react";
import { useSession } from "../../game/session";
import { fleetGet } from "../../lib/fleetApi";
import { GRUDGE_FLEET_URLS, studioHubUrl } from "../../lib/fleetUrls";

type AccountSnap = {
  grudgeId?: string;
  displayName?: string;
  email?: string;
  walletAddress?: string;
  serverWalletAddress?: string;
};

export function AuthPanel() {
  const { user, loading, error, guest, signInWithStudio, signOut } = useSession();
  const [account, setAccount] = useState<AccountSnap | null>(null);

  useEffect(() => {
    if (!user || user.role === "guest") {
      setAccount(null);
      return;
    }
    void fleetGet<AccountSnap>("/api/account").then((r) => {
      if (r.ok) setAccount(r.data);
    });
  }, [user]);

  if (user) {
    const wallet = account?.walletAddress || account?.serverWalletAddress;
    return (
      <div className="gw-hub-body">
        <div className="gw-account-card">
          <div className="gw-account-name">{user.displayName || user.username}</div>
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
              <span className="gw-account-v">{Number(user.gbuxBalance).toLocaleString()}</span>
            </div>
            {account?.email && (
              <div>
                <span className="gw-account-k">Email</span>
                <span className="gw-account-v">{account.email}</span>
              </div>
            )}
            {wallet && (
              <div>
                <span className="gw-account-k">Wallet</span>
                <span className="gw-account-v" title={wallet}>
                  {wallet.slice(0, 4)}…{wallet.slice(-4)}
                </span>
              </div>
            )}
          </div>
          <p className="gw-account-hint">
            One Grudge ID across the fleet. Characters / wallet / Treaty stay on{" "}
            <strong>Railway Postgres</strong> (same-origin <code>/api/*</code>).
          </p>
          {user.role === "guest" && (
            <p className="gw-account-hint">
              Guest progress stays on this device. Sign in with Grudge ID to keep characters, wallet, and Treaty
              across games.
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <button type="button" className="gw-btn gw-btn-ghost" onClick={signOut} disabled={loading}>
              {loading ? "Signing out…" : "Sign out"}
            </button>
            <a className="gw-btn gw-btn-ghost" href={studioHubUrl("account")} target="_blank" rel="noreferrer">
              Studio account
            </a>
            <a
              className="gw-btn gw-btn-ghost"
              href={`${GRUDGE_FLEET_URLS.identity}/login?redirect_uri=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin + "/" : GRUDGE_FLEET_URLS.warlordGenesis)}`}
              target="_blank"
              rel="noreferrer"
            >
              Grudge ID
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gw-hub-body">
      <div className="gw-auth-intro">
        <p className="gw-auth-lead">
          Sign in with <strong>Grudge ID</strong> (<code>id.grudge-studio.com</code>) for one account across Warlord
          Genesis, Warlords, crafting, wallet, and Treaty. Player SSOT is Railway — never a separate fake API.
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
        {loading ? "Opening Grudge ID…" : "Sign in with Grudge ID"}
      </button>

      <div className="gw-or">or</div>
      <button type="button" className="gw-btn gw-btn-ghost" onClick={guest} disabled={loading}>
        Continue as guest
      </button>
      <p className="gw-account-hint" style={{ marginTop: 12 }}>
        Guests can skirmish locally. Fleet wallet + Treaty require a real Grudge ID.
      </p>
    </div>
  );
}
