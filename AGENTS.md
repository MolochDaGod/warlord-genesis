# Warlord Genesis — agent rules

This repo is a Three.js MOBA/RTS. Follow these rules in every session.

## Skills (always load when relevant)

User-level pack lives in `~/.grok/skills/` (also `~/.agents/skills/`). Do **not** vendor it into the Vercel ship.

| Trigger | Skill |
|---------|--------|
| Game loop, polish, “make it playable”, premium | `threejs-game-director` |
| Combat, input, feel, ability states | `threejs-gameplay-systems` |
| Lighting, materials, “looks cheap” | `threejs-aaa-graphics-builder` |
| HUD, 6-slot hotbar, menus | `threejs-game-ui-designer` |
| T-pose, mixer, draw calls, black screen | `threejs-debug-profiler` |
| Ship / QA / screenshots | `threejs-qa-release` |
| Concept sheets, textures, UI art | `threejs-image-generator` |
| Image-to-3D / generated GLB | `threejs-3d-generator` |
| SFX / voice | `threejs-audio-generator` |
| Any skinned hero/unit spawn | `deploy-animated-character` |

Local animation contract: `engine/threeAnim/*` + `docs/THREE_ANIM_HELPERS.md`.
Agent + Gemini setup: `docs/AGENT_THREEJS_SKILLS.md`.

## Animation (hard)

- Native GLB/FBX clips first. Baked JSON is fill only.
- `SkeletonUtils.clone` + per-instance `AnimationMixer`. Never `Object3D.clone` a skinned mesh.
- Freeze hips XZ travel; keep Y bob; phase-lock walk/run to a master clip.
- Empty / missing clips = T-pose. Do not invent a mixer with no tracks.

## Combat HUD

Danger Room **6-slot** hotbar (keys 1–6). Heroes pick abilities from **card-level unlocks before the match**, not mid-match.

## Gemini / generators

- `GEMINI_API_KEY` is a **local agent secret** (User env + `~/.grok/gemini.env`).
- Never put it in git, `VITE_*`, client JS, or `artifacts/`.
- Probe only (prints SET|MISSING): `node scripts/gemini-probe.mjs`
- Concepts land in `assets/concepts/` (gitignored).

## Deploy

Source of truth: `C:\Users\david\Desktop\warlord-genesis`.
Do not upload monorepo bloat (`artifacts/`, `attached_assets/`, unused `lib/`). Vercel `outputDirectory` is `.`.
