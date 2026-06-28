import { useRef, useState } from "react";
import { chatStream, ensureSignedIn, isPuterReady } from "../../lib/puter";
import { ICONS } from "./icons";

type WorkerMode = "assistant" | "debug";

interface Msg {
  role: "user" | "ai";
  text: string;
}

const SYSTEM: Record<WorkerMode, string> = {
  assistant:
    "You are the Grudge Warlords in-game AI worker. Answer concisely and helpfully about strategy, lore, crafting, and the Grudge Studio universe.",
  debug:
    "You are a senior engineer acting as a script-debugging admin. Given code or an error, identify the root cause and return a corrected snippet plus a one-line explanation. Be precise and terse.",
};

export function AIWorker() {
  const [mode, setMode] = useState<WorkerMode>("assistant");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [puterUser, setPuterUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const connect = async () => {
    setError(null);
    const name = await ensureSignedIn();
    setPuterUser(name);
  };

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: prompt }, { role: "ai", text: "" }]);
    scrollDown();

    const full = `${SYSTEM[mode]}\n\n${mode === "debug" ? "Code / error to debug:\n" : "User:\n"}${prompt}`;

    try {
      await chatStream(full, (chunk) => {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "ai") next[next.length - 1] = { role: "ai", text: last.text + chunk };
          return next;
        });
        scrollDown();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
      scrollDown();
    }
  };

  return (
    <div className="gw-hub-body gw-ai">
      <div className="gw-ai-head">
        <div className="gw-auth-switch gw-ai-modes">
          <button
            className={mode === "assistant" ? "active" : ""}
            onClick={() => setMode("assistant")}
          >
            <img className="gw-mode-icon" src={ICONS.lab} alt="" draggable={false} />
            AI WORKER
          </button>
          <button
            className={mode === "debug" ? "active" : ""}
            onClick={() => setMode("debug")}
          >
            <img className="gw-mode-icon" src={ICONS.settings} alt="" draggable={false} />
            SCRIPT DEBUG
          </button>
        </div>
        <div className="gw-ai-conn">
          {puterUser ? (
            <span className="gw-ai-user">Puter: {puterUser}</span>
          ) : (
            <button className="gw-btn gw-btn-mini" onClick={connect}>
              CONNECT PUTER
            </button>
          )}
        </div>
      </div>

      {!isPuterReady() && (
        <div className="gw-codex-status">Loading Puter.js AI runtime...</div>
      )}

      <div className="gw-ai-log" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="gw-ai-empty">
            {mode === "debug"
              ? "Paste a code snippet or an error and the admin worker will diagnose it. AI usage is billed to your own Puter account."
              : "Ask the AI worker about strategy, lore, or the Grudge universe. AI usage is billed to your own Puter account."}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`gw-ai-msg gw-ai-${m.role}`}>
            <pre>{m.text || (m.role === "ai" ? "..." : "")}</pre>
          </div>
        ))}
      </div>

      {error && <div className="gw-form-error">{error}</div>}

      <div className="gw-ai-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            mode === "debug"
              ? "Paste code or an error... (Ctrl+Enter to send)"
              : "Ask anything... (Ctrl+Enter to send)"
          }
          rows={mode === "debug" ? 5 : 2}
        />
        <button className="gw-btn" onClick={send} disabled={busy}>
          {busy ? "..." : "SEND"}
        </button>
      </div>
    </div>
  );
}
