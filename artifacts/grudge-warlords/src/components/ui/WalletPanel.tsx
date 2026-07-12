import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../game/session";
import { fleetGet, fleetPost } from "../../lib/fleetApi";
import { studioHubUrl } from "../../lib/fleetUrls";

type WalletStatus = {
  hasWallet?: boolean;
  walletType?: string | null;
  walletAddress?: string | null;
};

export function WalletPanel() {
  const user = useSession((s) => s.user);
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [resources, setResources] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || user.role === "guest") {
      setStatus(null);
      setResources(null);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    const [w, r] = await Promise.all([
      fleetGet<WalletStatus>("/api/wallet/status"),
      fleetGet<Record<string, unknown>>("/api/account/resources"),
    ]);
    if (!w.ok && w.status === 401) {
      setErr("Sign in with Grudge ID to load Railway wallet.");
    } else if (!w.ok) {
      setErr(w.error || "Wallet status failed");
    } else {
      setStatus(w.data);
    }
    if (r.ok) setResources(r.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createWallet = async () => {
    setMsg(null);
    setErr(null);
    const email =
      (user as { email?: string } | null)?.email ||
      (typeof user?.username === "string" && user.username.includes("@") ? user.username : null);
    if (!email) {
      setErr("Link an email on your Grudge ID before creating a Crossmint wallet.");
      return;
    }
    setLoading(true);
    const res = await fleetPost<WalletStatus>("/api/wallet/create", { email });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error || "Create failed");
      return;
    }
    setMsg("Server wallet ready");
    setStatus(res.data);
    void refresh();
  };

  if (!user) {
    return (
      <div className="gw-hub-body">
        <p className="gw-auth-lead">
          Sign in with <strong>Grudge ID</strong> to open your account-scope wallet (GBUX, Solana).
          Player SSOT is Railway Postgres — same bag across Warlords, crafting, and this warcamp.
        </p>
      </div>
    );
  }

  if (user.role === "guest") {
    return (
      <div className="gw-hub-body">
        <p className="gw-account-hint">
          Guests have no fleet wallet. Sign in with Grudge ID to use Railway{" "}
          <code>/api/wallet</code> and shared GBUX.
        </p>
        <a className="gw-btn gw-btn-ghost" href={studioHubUrl("wallet")} target="_blank" rel="noreferrer">
          Open studio hub wallet →
        </a>
      </div>
    );
  }

  const gbux =
    resources && typeof resources === "object"
      ? (resources as { gbux?: number; GBUX?: number }).gbux ??
        (resources as { GBUX?: number }).GBUX
      : null;
  const addr = status?.walletAddress;

  return (
    <div className="gw-hub-body">
      <div className="gw-account-card">
        <div className="gw-account-name">War Chest</div>
        <p className="gw-account-hint" style={{ marginBottom: 12 }}>
          Account scope · Railway <code>/api/wallet</code> · not character inventory
        </p>
        <div className="gw-account-grid">
          <div>
            <span className="gw-account-k">GBUX</span>
            <span className="gw-account-v">
              {gbux != null
                ? Number(gbux).toLocaleString()
                : Number(user.gbuxBalance || 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="gw-account-k">Type</span>
            <span className="gw-account-v">{status?.walletType || (addr ? "linked" : "none")}</span>
          </div>
        </div>
        <div className="gw-account-id" style={{ wordBreak: "break-all", marginTop: 10 }}>
          {addr || "No Solana address linked"}
        </div>
        {err && (
          <div className="gw-form-error" role="alert">
            {err}
          </div>
        )}
        {msg && <p className="gw-account-hint">{msg}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <button type="button" className="gw-btn gw-btn-ghost" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          {!addr && (
            <button type="button" className="gw-btn" onClick={() => void createWallet()} disabled={loading}>
              Create server wallet
            </button>
          )}
          <a className="gw-btn gw-btn-ghost" href={studioHubUrl("wallet")} target="_blank" rel="noreferrer">
            Full hub wallet
          </a>
        </div>
      </div>
    </div>
  );
}
