import { useEffect, useRef, useState } from "react";
import type { PrefabCharacter } from "@workspace/game-content";
import { codexEntryForCharacter, heroAiSystemPrompt } from "../../lib/heroCodex";
import { chatStream, ensureSignedIn, isPuterReady } from "../../lib/puter";
import { ICONS } from "./icons";

interface HeroVideoOverlayProps {
  prefab: PrefabCharacter;
  /** When true, show compact chips only (video playing). */
  compact?: boolean;
}

const INTRO_PROMPTS = [
  "In one sentence, how do you fight on the battlefield?",
  "What is your signature ability?",
  "Give new players one tip for your loadout.",
];

export function HeroVideoOverlay({ prefab, compact = false }: HeroVideoOverlayProps) {
  const codex = codexEntryForCharacter(prefab);
  const [expanded, setExpanded] = useState(false);
  const [intro, setIntro] = useState(codex?.quote ?? prefab.lore.slice(0, 140));
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const introIdx = useRef(0);

  useEffect(() => {
    setIntro(codex?.quote ?? prefab.lore.slice(0, 140));
    setReply(null);
    setExpanded(false);
  }, [prefab.id, codex?.quote, prefab.lore]);

  const askAi = async (prompt: string, target: "reply" | "intro" = "reply"): Promise<string> => {
    if (!prompt.trim() || busy) return "";
    if (!isPuterReady()) {
      setError("Puter AI loading — reload and sign in.");
      return "";
    }
    setBusy(true);
    setError(null);
    if (target === "reply") setReply("");
    try {
      await ensureSignedIn();
      const fullPrompt = `${heroAiSystemPrompt(prefab.id)}\n\nPlayer asks: ${prompt}\n${prefab.name}:`;
      const text = await chatStream(fullPrompt, (chunk) => {
        if (target === "reply") setReply((r) => (r ?? "") + chunk);
      });
      if (target === "intro" && text) setIntro(text);
      return text;
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI failed");
      if (target === "reply") setReply(null);
      return "";
    } finally {
      setBusy(false);
    }
  };

  const cycleIntro = () => {
    const tips = [
      codex?.quote,
      codex?.combatStyle ? `Style: ${codex.combatStyle}` : null,
      codex?.abilities?.[0] ? `${codex.abilities[0].name} — ${codex.abilities[0].description}` : null,
      codex?.flavorText,
    ].filter(Boolean) as string[];
    if (!isPuterReady() || busy || tips.length === 0) {
      const next = tips[introIdx.current % Math.max(tips.length, 1)] ?? prefab.lore.slice(0, 140);
      introIdx.current += 1;
      setIntro(next);
      return;
    }
    const prompt = INTRO_PROMPTS[introIdx.current % INTRO_PROMPTS.length];
    introIdx.current += 1;
    void askAi(prompt, "intro");
  };

  return (
    <div className={`gw-hero-video-overlay${compact ? " gw-hero-video-overlay--compact" : ""}${expanded ? " is-expanded" : ""}`}>
      <div className="gw-hero-video-chips">
        {codex?.rarity && <span className="gw-hero-chip gw-hero-chip--rarity">{codex.rarity}</span>}
        {codex?.combatStyle && <span className="gw-hero-chip">{codex.combatStyle}</span>}
        {codex?.difficulty && <span className="gw-hero-chip">{codex.difficulty}</span>}
        {codex?.alignment && <span className="gw-hero-chip gw-hero-chip--muted">{codex.alignment}</span>}
      </div>

      <button type="button" className="gw-hero-video-intro" onClick={() => void cycleIntro()} title="Tap for codex lore or AI tip">
        <span className="gw-hero-video-intro-label">Codex</span>
        <p>{busy && !reply ? "…" : intro}</p>
      </button>

      {codex?.abilities?.[0] && !expanded && (
        <div className="gw-hero-video-ability">
          <strong>{codex.abilities[0].name}</strong>
          <span>{codex.abilities[0].description}</span>
        </div>
      )}

      <button
        type="button"
        className="gw-hero-video-ai-toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <img className="gw-btn-icon" src={ICONS.chat} alt="" draggable={false} />
        {expanded ? "Hide AI" : "Ask AI"}
      </button>

      {expanded && (
        <div className="gw-hero-video-ai-panel">
          {reply && (
            <div className="gw-hero-video-ai-reply">
              <span>{prefab.name}</span>
              <p>{reply}</p>
            </div>
          )}
          {error && <p className="gw-form-error">{error}</p>}
          <div className="gw-hero-video-ai-input">
            <input
              type="text"
              value={input}
              placeholder={`Ask ${prefab.name}…`}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void askAi(input).then(() => setInput(""))}
            />
            <button
              type="button"
              className="gw-btn gw-btn-mini"
              disabled={busy || !input.trim()}
              onClick={() => void askAi(input).then(() => setInput(""))}
            >
              {busy ? "…" : "ASK"}
            </button>
          </div>
          <span className="gw-hero-ai-sub">Canonical lore from grudge-heros.puter.site</span>
        </div>
      )}
    </div>
  );
}