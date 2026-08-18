# AI agent + Three.js skills + Gemini

The [threejs-game-skills](https://github.com/MolochDaGod/threejs-game-skills) pack is installed for this machine’s agents (Grok + `.agents`). It is **not** shipped in the Vercel game bundle.

## Installed skills

| Skill | Use |
|-------|-----|
| `threejs-game-director` | Orchestrate a playable loop / polish pass |
| `threejs-gameplay-systems` | Feel, input, combat, animation states |
| `threejs-aaa-graphics-builder` | Lighting, materials, visual scorecard |
| `threejs-game-ui-designer` | HUD / 6-slot bar / safe areas |
| `threejs-debug-profiler` | Black screen, draw calls, mixer cost |
| `threejs-qa-release` | Build + browser evidence |
| `threejs-image-generator` | Gemini concepts / textures / UI art |
| `threejs-3d-generator` | Tripo GLB (needs `TRIPO_API_KEY`) |
| `threejs-audio-generator` | ElevenLabs (needs `ELEVENLABS_API_KEY`) |

Plus our local helpers: `deploy-animated-character`, `engine/threeAnim/*` (Samurai retarget / phase-lock / concept clips).

## Credentials (never in git, never in the browser)

```
GEMINI_API_KEY=SET   ← User env + ~/.grok/gemini.env (never in git)
TRIPO_API_KEY=MISSING
ELEVENLABS_API_KEY=MISSING
```

Probe on this machine: **SET**. Auth ping: `GEMINI_AUTH=FAIL http=400 location_unsupported FAILED_PRECONDITION`. Google is blocking the Generative Language API (text + image) from this region. Use a VPN / AI Studio-allowed region, or generate concepts with the local Imagine tool until that lifts.

Set Gemini once (PowerShell, this user only):

```powershell
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "<key>", "User")
```

Probe (prints SET/MISSING only — never the key):

```powershell
# Windows (this repo) — also loads User env + ~/.grok/gemini.env
node scripts/gemini-probe.mjs
node scripts/gemini-probe.mjs ping   # optional: auth check, no key printed

# Official skill script (needs a real Python, not the Store alias)
$env:GEMINI_API_KEY = [Environment]::GetEnvironmentVariable("GEMINI_API_KEY","User")
py $env:USERPROFILE\.grok\skills\threejs-image-generator\scripts\generate_image.py probe
```

Do **not** put `GEMINI_API_KEY` in `VITE_*` or any file under `artifacts/`. Image gen is an agent tool, not a runtime API.

Project teaching: `AGENTS.md` (repo) and `~/.grok/rules/threejs-game-skills.md` (all sessions).

## How to ask the agent

```
Use threejs-game-director on warlord-genesis.
Keep Rapier + Sanctum + Danger Room 6-slot HUD.
Use threejs-image-generator for concept sheets (idle/walk/slash) when GEMINI is SET.
Use engine/threeAnim (Samurai retarget + phase-lock) for mixers — never empty clips.
```

## Concept animation learning loop

1. Gemini: generate a **concept sheet** (T-pose + idle + walk + slash) into `assets/concepts/` (local, gitignored or LFS).
2. Optional Tripo: image-to-3D GLB.
3. Runtime: `SkeletonUtils.clone` → mixer → `classifyConceptClips` → `playConcept("slash")`.

See `docs/THREE_ANIM_HELPERS.md`.
