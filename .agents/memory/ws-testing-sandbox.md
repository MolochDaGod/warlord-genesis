---
name: WebSocket testing in this repo
description: How to run a headless WS client to test the realtime server; sandbox limitations.
---

The `code_execution` sandbox has **no `ws` package and no global `WebSocket`** (despite Node 24). Do not try to `import('ws')` or `new WebSocket()` there.

To smoke-test the realtime server (`/api/realtime`), write a short `.mjs` node script that `import WS from "ws"` and place it **inside a package that depends on `ws`** (e.g. `artifacts/api-server/`), then run it from that directory. pnpm module resolution is keyed to the script file's location, not the shell cwd — a script in `.local/` or repo root cannot resolve `ws`.

**Why:** pnpm's virtual store only exposes a dependency to packages that declare it; a loose script outside any such package fails with ERR_MODULE_NOT_FOUND.

**How to apply:** copy the test into `artifacts/api-server/`, `node it`, then delete it. Connect through the shared proxy at `ws://localhost:80/api/realtime` (never the service port directly). The browser preview connects through the same proxy, so a "CONNECTED" lobby confirms the wss/ws auto-derivation works end-to-end.
