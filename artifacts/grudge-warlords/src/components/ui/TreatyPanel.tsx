import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../game/session";
import { fleetGet, fleetPost } from "../../lib/fleetApi";
import { GRUDGE_FLEET_URLS, studioHubUrl } from "../../lib/fleetUrls";

type Social = {
  friends?: { displayName?: string; grudgeId?: string; status?: string }[];
  pendingIncoming?: { id?: string; displayName?: string; grudgeId?: string }[];
};

type Channel = { slug?: string; id?: string; name?: string };
type Message = {
  content?: string;
  body?: string;
  senderDisplayName?: string;
  senderGrudgeId?: string;
  createdAt?: string;
};

export function TreatyPanel() {
  const user = useSession((s) => s.user);
  const [social, setSocial] = useState<Social | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [slug, setSlug] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user || user.role === "guest") return;
    setLoading(true);
    setErr(null);
    const [soc, ch] = await Promise.all([
      fleetGet<Social>("/api/treaty/social"),
      fleetGet<{ channels?: Channel[]; servers?: Channel[] }>("/api/treaty/servers?game=warlords"),
    ]);
    if (!soc.ok && soc.status === 401) {
      setErr("Sign in with Grudge ID for Treaty (account-scoped social).");
      setLoading(false);
      return;
    }
    if (soc.ok) setSocial(soc.data);
    else setErr(soc.error || "Treaty social failed");
    const list = ch.data?.channels || ch.data?.servers || [];
    setChannels(list);
    if (!slug && list.length) setSlug(list[0].slug || list[0].id || "");
    setLoading(false);
  }, [user, slug]);

  const loadMessages = useCallback(async () => {
    if (!slug || !user || user.role === "guest") return;
    const res = await fleetGet<{ messages?: Message[] }>(
      `/api/treaty/servers/${encodeURIComponent(slug)}/messages?limit=40`,
    );
    if (res.ok) setMessages(res.data?.messages || []);
  }, [slug, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMessages();
    if (!slug) return;
    const t = setInterval(() => void loadMessages(), 8000);
    return () => clearInterval(t);
  }, [slug, loadMessages]);

  const send = async () => {
    const content = text.trim();
    if (!content || !slug) return;
    setText("");
    const res = await fleetPost(`/api/treaty/servers/${encodeURIComponent(slug)}/messages`, {
      content,
    });
    if (!res.ok) setErr(res.error || "Send failed");
    void loadMessages();
  };

  if (!user) {
    return (
      <div className="gw-hub-body">
        <p className="gw-auth-lead">
          <strong>Treaty</strong> is account-level friends, DMs, and fleet chat (Railway Postgres).
          Sign in with Grudge ID — same social graph in every game.
        </p>
      </div>
    );
  }

  if (user.role === "guest") {
    return (
      <div className="gw-hub-body">
        <p className="gw-account-hint">Guests cannot use Treaty. Sign in to join fleet server chat.</p>
        <a className="gw-btn gw-btn-ghost" href={studioHubUrl("treaty")} target="_blank" rel="noreferrer">
          Open studio Treaty →
        </a>
      </div>
    );
  }

  const friends = (social?.friends || []).filter((f) => !f.status || f.status === "accepted");

  return (
    <div className="gw-hub-body">
      <div className="gw-account-card" style={{ marginBottom: 12 }}>
        <div className="gw-account-name">Treaty · Fleet social</div>
        <p className="gw-account-hint">
          Account-scoped · <code>/api/treaty</code> · not character UUID
        </p>
        {err && (
          <div className="gw-form-error" role="alert">
            {err}
          </div>
        )}
        <div className="gw-account-grid">
          <div>
            <span className="gw-account-k">Friends</span>
            <span className="gw-account-v">{friends.length}</span>
          </div>
          <div>
            <span className="gw-account-k">Channels</span>
            <span className="gw-account-v">{channels.length}</span>
          </div>
        </div>
        {friends.length > 0 && (
          <p className="gw-account-hint" style={{ marginTop: 8 }}>
            {friends
              .slice(0, 6)
              .map((f) => f.displayName || f.grudgeId)
              .join(", ")}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <button type="button" className="gw-btn gw-btn-ghost" onClick={() => void load()} disabled={loading}>
            {loading ? "…" : "Refresh"}
          </button>
          <a
            className="gw-btn gw-btn-ghost"
            href={`${GRUDGE_FLEET_URLS.warlords}/treaty`}
            target="_blank"
            rel="noreferrer"
          >
            Full Treaty app
          </a>
          <a className="gw-btn gw-btn-ghost" href={studioHubUrl("treaty")} target="_blank" rel="noreferrer">
            Studio hub
          </a>
        </div>
      </div>

      <div className="gw-codex-tabs" style={{ marginBottom: 8 }}>
        {channels.map((c) => {
          const id = c.slug || c.id || "";
          return (
            <button
              key={id}
              type="button"
              className={id === slug ? "active" : ""}
              onClick={() => setSlug(id)}
            >
              {c.name || id}
            </button>
          );
        })}
        {!channels.length && <span className="gw-account-hint">No channels yet</span>}
      </div>

      <div
        className="gw-account-card"
        style={{ maxHeight: 200, overflowY: "auto", marginBottom: 8, fontSize: 13 }}
      >
        {messages.length === 0 && <p className="gw-account-hint">No messages — say hello.</p>}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong style={{ color: "var(--gw-gold, #c9a84c)" }}>
              {m.senderDisplayName || m.senderGrudgeId || "Player"}
            </strong>
            <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 11 }}>
              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ""}
            </span>
            <div>{m.content || m.body}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="gw-codex-search"
          style={{ flex: 1 }}
          value={text}
          maxLength={2000}
          placeholder={slug ? "Message fleet…" : "Select a channel"}
          disabled={!slug}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
        />
        <button type="button" className="gw-btn" disabled={!slug || !text.trim()} onClick={() => void send()}>
          Send
        </button>
      </div>
    </div>
  );
}
