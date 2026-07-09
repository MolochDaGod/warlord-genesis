// ── AI assistant shared contract ──────────────────────────────────────────────
//
// Plain-English in-world requests are turned into *proposed* actions the player
// reviews before anything is committed. This module is the single source of truth
// for the action shape, the catalog grounding handed to the LLM, and a
// deterministic keyword fallback planner used when no model key is configured.
//
// It is consumed by BOTH the Cloudflare AI worker (the "brain") and the
// grudge-game client (the apply loop), so it must stay free of DOM/Node globals
// (no TextEncoder/Buffer/fetch types) — pure data + pure functions only.

import { ANIM_LIBRARY_BAKED, type AnimClipDef } from "./animations";
import { skillBlendFor, SKILL_BLEND_BY_CATEGORY } from "./animDefaults";
import { WEAPON_SKILL_TREES } from "./weaponSkills";

// ── Action shape ──────────────────────────────────────────────────────────────

export type AiActionKind = "animation" | "vfx" | "catalog";

/** One baked clip the player can preview live before binding it to a slot. */
export interface AiAnimationCandidate {
  animKey: string;
  /** Baked clip path under /anims/baked (no .json) — required (must be previewable). */
  baked: string;
  label: string;
  note?: string;
}

/**
 * Animation requests are NOT auto-assigned: the AI proposes candidate baked
 * clips and a suggested blend; the player previews each and picks one + blend.
 */
export interface AiAnimationAction {
  kind: "animation";
  /** Target action-bar skill slot (1..6). */
  slot: number;
  /** Suggested default overlay blend (0..1). */
  blend: number;
  candidates: AiAnimationCandidate[];
}

/** A patch merged into a skill's VFX config (skillVfx seam), keyed by skillId. */
export interface AiVfxAction {
  kind: "vfx";
  skillId: string;
  patch: Record<string, unknown>;
  note?: string;
}

/** An edit to an animation-catalog entry's metadata (label/category/loop). */
export interface AiCatalogAction {
  kind: "catalog";
  animKey: string;
  label?: string;
  category?: string;
  loop?: boolean;
  note?: string;
}

export type AiAction = AiAnimationAction | AiVfxAction | AiCatalogAction;

export interface AiAssistantResponse {
  /** Conversational reply shown in the chat panel. */
  reply: string;
  /** Proposed actions the player reviews + confirms. */
  actions: AiAction[];
  /** Whether a real model answered or the deterministic fallback did. */
  source: "gemini" | "fallback";
}

export interface AiAssistantRequest {
  message: string;
  /** Optional context: the GRUDGE ID + equipped weapon to bias proposals. */
  grudgeId?: string;
  weaponType?: string;
}

// ── Catalog grounding (compact, handed to the model) ──────────────────────────

export interface AiAnimCatalogEntry {
  key: string;
  label: string;
  category: string;
  baked: string;
  /** Suggested overlay blend when bound to a skill slot. */
  suggestedBlend: number;
}

/** Previewable baked clips — the ONLY valid animation candidates. */
export function aiAnimCatalog(): AiAnimCatalogEntry[] {
  return ANIM_LIBRARY_BAKED.map((a) => ({
    key: a.key,
    label: a.label ?? a.key,
    category: a.category,
    baked: a.baked as string,
    suggestedBlend:
      SKILL_BLEND_BY_CATEGORY[a.category] ?? skillBlendFor("", a.key),
  }));
}

export interface AiSkillCatalogEntry {
  id: string;
  label: string;
  type: string;
  animKey?: string;
  effects: string[];
}

/** Weapon-skill nodes the assistant can re-bind or re-skin (VFX). */
export function aiSkillCatalog(): AiSkillCatalogEntry[] {
  const out: AiSkillCatalogEntry[] = [];
  for (const tree of WEAPON_SKILL_TREES) {
    for (const node of tree.nodes) {
      out.push({
        id: node.id,
        label: node.label,
        type: tree.type,
        animKey: node.animKey,
        effects: node.effects,
      });
    }
  }
  return out;
}

/** System prompt + JSON contract description used to ground the LLM. */
export function buildAiSystemPrompt(): string {
  const anims = aiAnimCatalog();
  const skills = aiSkillCatalog();
  return [
    "You are the in-world assistant for GRUDGE, a dark-fantasy action game.",
    "The player types plain-English requests to customise their character's",
    "skill animations and ability visual effects. You PROPOSE changes; the player",
    "always previews and confirms — you never apply anything yourself.",
    "",
    "Respond with ONLY a JSON object of this exact shape (no markdown, no prose):",
    '{ "reply": string, "actions": Action[] }',
    "",
    "Action is one of:",
    '  { "kind": "animation", "slot": number(1-6), "blend": number(0-1),',
    '    "candidates": [{ "animKey": string, "baked": string, "label": string, "note"?: string }] }',
    '  { "kind": "vfx", "skillId": string, "patch": object, "note"?: string }',
    '  { "kind": "catalog", "animKey": string, "label"?: string, "category"?: string, "loop"?: boolean, "note"?: string }',
    "",
    "Rules:",
    "- For animation requests propose 2-4 candidates the player can preview, then pick.",
    "- Use each candidate's suggestedBlend as the default overlay (magic/swim ~0.55-0.6, melee ~0.9-1).",
    "- animKey AND baked MUST come from the ANIMATION CATALOG below (never invent paths).",
    "- Prefer clips matching intent: harvest/survival, swimming, traversal/climb, combat, locomotion.",
    "- vfx skillId MUST come from the SKILL CATALOG. patch is a shallow set of fields to merge.",
    "- Keep reply to one or two friendly sentences.",
    "",
    "ANIMATION CATALOG (previewable baked clips):",
    ...anims.map(
      (a) => `  ${a.key} | ${a.label} | ${a.category} | blend=${a.suggestedBlend} | ${a.baked}`,
    ),
    "",
    "SKILL CATALOG:",
    ...skills.map(
      (s) => `  ${s.id} | ${s.label} | ${s.type} | anim=${s.animKey ?? "-"}`,
    ),
  ].join("\n");
}

// ── Deterministic fallback planner (no model key) ─────────────────────────────

const STOP = new Set([
  "the", "a", "an", "to", "for", "with", "on", "my", "me", "i", "want",
  "make", "set", "use", "give", "please", "skill", "slot", "ability", "and",
  "of", "it", "this", "that", "change", "into", "like", "as",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function scoreAnim(toks: string[], a: AiAnimCatalogEntry): number {
  const hay = `${a.key} ${a.label} ${a.category}`.toLowerCase();
  let score = 0;
  for (const t of toks) {
    if (hay.includes(t)) score += 2;
    else if (a.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(t)))
      score += 1;
  }
  return score;
}

/** Parse an explicit "slot N" / "skill N" (1..6); default 1. */
function parseSlot(message: string): number {
  const m = message.match(/\b(?:slot|skill|ability|bar)\s*#?\s*([1-6])\b/i);
  if (m) return Number(m[1]);
  const n = message.match(/\b([1-6])\b/);
  return n ? Number(n[1]) : 1;
}

const COLOR_WORDS: Record<string, string> = {
  red: "#ff3b30", crimson: "#b00020", blood: "#7a0010",
  blue: "#1e90ff", azure: "#2bb3ff", frost: "#9fe8ff",
  green: "#34c759", poison: "#7bd14a", emerald: "#00a86b",
  purple: "#8e44ad", violet: "#9b59b6", shadow: "#3a2d5c",
  gold: "#ffd166", yellow: "#ffe066", white: "#ffffff",
  black: "#10101a", orange: "#ff7a18", fire: "#ff5a1f",
};

function detectColor(toks: string[]): string | undefined {
  for (const t of toks) if (COLOR_WORDS[t]) return COLOR_WORDS[t];
  return undefined;
}

const INTENT_CATEGORY: Record<string, string[]> = {
  slam: ["combat", "combat_sword", "combat_unarmed"],
  smash: ["combat", "combat_sword"],
  dash: ["combat", "locomotion"],
  spin: ["combat_unarmed", "combat_sword"],
  punch: ["combat_unarmed"],
  kick: ["combat_unarmed"],
  block: ["combat_shield", "combat_sword"],
  shield: ["combat_shield"],
  arrow: ["combat_throw", "combat"],
  bow: ["combat_throw"],
  cast: ["combat", "magic"],
  spell: ["combat"],
  magic: ["combat"],
  frost: ["combat"],
  fire: ["combat"],
  fish: ["survival"],
  harvest: ["survival"],
  mine: ["survival"],
  chop: ["survival"],
  climb: ["traversal"],
  ladder: ["traversal"],
  swim: ["swimming"],
  dodge: ["combat", "locomotion"],
  roll: ["locomotion", "combat"],
  venom: ["combat_unarmed", "combat", "traversal"],
  symbiote: ["combat", "combat_unarmed"],
  tentacle: ["combat_unarmed"],
  tendril: ["combat_unarmed"],
  devour: ["combat"],
  wallrun: ["traversal"],
  crawl: ["traversal"],
  knockout: ["combat"],
  stagger: ["combat"],
  shackle: ["combat"],
  flight: ["traversal", "combat"],
  hover: ["traversal"],
  stealth: ["traversal"],
};

const VFX_INTENT = new Set([
  "vfx", "effect", "effects", "particles", "particle", "glow", "trail",
  "aura", "color", "colour", "flame", "flames", "spark", "sparks",
]);

/**
 * Keyword planner used when no model key is configured. Always tries to surface
 * a few animation candidates; adds a VFX patch when colour/effect intent shows.
 */
export function fallbackAiPlan(req: AiAssistantRequest): AiAssistantResponse {
  const message = req.message ?? "";
  const toks = tokens(message);
  const catalog = aiAnimCatalog();

  const wantsVfx =
    toks.some((t) => VFX_INTENT.has(t)) || !!detectColor(toks);

  const actions: AiAction[] = [];

  // Animation candidates: top scored baked clips.
  const intentCats = new Set<string>();
  for (const t of toks) {
    for (const cat of INTENT_CATEGORY[t] ?? []) intentCats.add(cat);
  }

  const ranked = catalog
    .map((a) => {
      let s = scoreAnim(toks, a);
      if (intentCats.size && intentCats.has(a.category)) s += 4;
      return { a, s };
    })
    .filter((r) => r.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, 4)
    .map((r) => r.a);

  const picks = ranked.length
    ? ranked
    : catalog.filter((a) => a.category.startsWith("combat")).slice(0, 3);

  if (!wantsVfx || ranked.length) {
    const topBlend = picks[0]?.suggestedBlend ?? 1;
    actions.push({
      kind: "animation",
      slot: parseSlot(message),
      blend: topBlend,
      candidates: picks.map((a) => ({
        animKey: a.key,
        baked: a.baked,
        label: a.label,
        note: `${a.category} · blend ${a.suggestedBlend}`,
      })),
    });
  }

  // VFX patch: re-skin a skill's colour if colour/effect intent is present.
  if (wantsVfx) {
    const skills = aiSkillCatalog();
    const wt = req.weaponType?.toLowerCase();
    const skill =
      (wt && skills.find((s) => s.type === wt)) ?? skills[0];
    if (skill) {
      const color = detectColor(toks);
      const patch: Record<string, unknown> = {};
      if (color) patch.color = color;
      actions.push({
        kind: "vfx",
        skillId: skill.id,
        patch: Object.keys(patch).length ? patch : { intensity: 1.4 },
        note: color
          ? `Tint ${skill.label} VFX ${color}`
          : `Boost ${skill.label} VFX`,
      });
    }
  }

  const reply = actions.length
    ? "Here are a few options — preview the clips and pick the one you like, then confirm."
    : "I couldn't match that to a clip or effect. Try naming an action (e.g. \"slam\", \"dash\", \"spin\") or a colour.";

  return { reply, actions, source: "fallback" };
}

/** Narrow unknown JSON (e.g. a model reply) into a safe AiAssistantResponse. */
export function coerceAiResponse(
  raw: unknown,
  source: AiAssistantResponse["source"],
): AiAssistantResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const reply = typeof o.reply === "string" ? o.reply : "";
  const rawActions = Array.isArray(o.actions) ? o.actions : [];
  const bakedByKey = new Map<string, AnimClipDef>(
    ANIM_LIBRARY_BAKED.map((a) => [a.key, a]),
  );
  const validSkillIds = new Set(aiSkillCatalog().map((s) => s.id));

  const actions: AiAction[] = [];
  for (const a of rawActions) {
    if (!a || typeof a !== "object") continue;
    const act = a as Record<string, unknown>;
    if (act.kind === "animation") {
      const cands = Array.isArray(act.candidates) ? act.candidates : [];
      const candidates: AiAnimationCandidate[] = [];
      for (const c of cands) {
        if (!c || typeof c !== "object") continue;
        const cc = c as Record<string, unknown>;
        const animKey = typeof cc.animKey === "string" ? cc.animKey : "";
        const def = bakedByKey.get(animKey);
        if (!def || !def.baked) continue; // must be a real previewable clip
        candidates.push({
          animKey,
          baked: def.baked,
          label: typeof cc.label === "string" ? cc.label : def.label ?? animKey,
          note: typeof cc.note === "string" ? cc.note : undefined,
        });
      }
      if (!candidates.length) continue;
      const slot =
        typeof act.slot === "number" && act.slot >= 1 && act.slot <= 6
          ? Math.round(act.slot)
          : 1;
      const blend =
        typeof act.blend === "number"
          ? Math.min(1, Math.max(0, act.blend))
          : 1;
      actions.push({ kind: "animation", slot, blend, candidates });
    } else if (act.kind === "vfx") {
      const skillId = typeof act.skillId === "string" ? act.skillId : "";
      if (!validSkillIds.has(skillId)) continue;
      const patch =
        act.patch && typeof act.patch === "object"
          ? (act.patch as Record<string, unknown>)
          : {};
      actions.push({
        kind: "vfx",
        skillId,
        patch,
        note: typeof act.note === "string" ? act.note : undefined,
      });
    } else if (act.kind === "catalog") {
      const animKey = typeof act.animKey === "string" ? act.animKey : "";
      if (!bakedByKey.has(animKey)) continue;
      actions.push({
        kind: "catalog",
        animKey,
        label: typeof act.label === "string" ? act.label : undefined,
        category: typeof act.category === "string" ? act.category : undefined,
        loop: typeof act.loop === "boolean" ? act.loop : undefined,
        note: typeof act.note === "string" ? act.note : undefined,
      });
    }
  }

  if (!reply && !actions.length) return null;
  return { reply: reply || "Here's what I came up with.", actions, source };
}
