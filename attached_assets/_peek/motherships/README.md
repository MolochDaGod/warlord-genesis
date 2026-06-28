# Game UI Kit — Multi-target Export

A self-contained, customized slice of your UI, exported for four runtimes.

## Shared files
- `kit.css` — the portable visual engine (all `.gk-*` classes).
- `theme.css` — your resolved theme tokens, palette/font overrides and chosen frames.
- `manifest.json` — machine-readable theme definition (tokens, frame slices, asset map, layout).
- `assets/` — only the image assets this theme uses.

## Targets (open each `index.html`)
- `html5/` — pure HTML + CSS. Drop the markup into any page.
- `vanilla-js/` — `gameui.js`, a zero-dependency runtime that builds widgets in JS.
- `canvas/` — `canvas-renderer.js`, draws themed 9-slice panels/bars/slots onto a 2D `<canvas>`.
- `webgl/` — the DOM kit overlaid as a HUD on a live WebGL scene (the standard pattern for GL games).

## Reuse
Add `kit.css` + `theme.css`, then wrap markup in `<div class="gk-root" data-gk-theme="...">`.
For canvas/engine HUDs, read `manifest.json` for tokens and 9-slice frame metadata.
