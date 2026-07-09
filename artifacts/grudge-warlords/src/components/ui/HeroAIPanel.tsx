import { useRef, useState } from "react";
import { chatStream, ensureSignedIn, isPuterReady } from "../../lib/puter";
import { heroAiSystemPrompt } from "../../lib/heroCodex";
import { ICONS } from "./icons";

interface Msg {
  role: "user" | "hero";
  text: string;
}

interface HeroAIPanelProps {
  prefabId: string;
  heroName: string;
}

export function HeroAIPanel({ prefabId, heroName }: HeroAIPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "hero",
      text: `I am ${heroName}. Ask me about my skills, loadout, or how I fight on the field.`,
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    if (!isPuterReady()) {
      setError("Puter AI is loading — reload the page.");
      return;
    }
    setInput("");
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: prompt }, { role: "hero", text: "" }]);
    scrollDown();

    const system = heroAiSystemPrompt(prefabId);
    const history = messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Player" : heroName}: ${m.text}`)
      .join("\n");
    const full = `${system}\n\nConversation:\n${history}\nPlayer: ${prompt}\n${heroName}:`;

    try {
      await ensureSignedIn();
      await chatStream(full, (chunk) => {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === "hero") next[next.length - 1] = { role: "hero", text: last.text + chunk };
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
    <div className="gw-hero-ai">
      <div className="gw-hero-ai-head">
        <img className="gw-btn-icon" src={ICONS.chat} alt="" draggable={false} />
        <span>Ask {heroName}</span>
        <span className="gw-hero-ai-sub">Powered by Puter · canonical Hero Codex lore</span>
      </div>
      <div className="gw-hero-ai-log" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`gw-hero-ai-msg gw-hero-ai-msg--${m.role}`}>
            <span className="gw-hero-ai-role">{m.role === "user" ? "You" : heroName}</span>
            <p>{m.text}</p>
          </div>
        ))}
      </div>
      {error && <p className="gw-form-error">{error}</p>}
      <div className="gw-hero-ai-input">
        <input
          type="text"
          value={input}
          placeholder={`Talk to ${heroName}…`}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
        />
        <button type="button" className="gw-btn gw-btn-mini" disabled={busy || !input.trim()} onClick={() => void send()}>
          {busy ? "…" : "ASK"}
        </button>
      </div>
    </div>
  );
}