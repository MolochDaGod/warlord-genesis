---
name: PvP client-side prediction via the shared Sim
description: How the Grudge Warlords client predicts its own hero using the same deterministic sim the server runs.
---

The client must predict its hero with the SAME code the server simulates — never a parallel hand-rolled kinematic loop. A separate client mover (duplicated speed constants, ad-hoc integration) is a correctness bug: it drifts from the authority and was rejected in review.

**The pattern (client owns a local `Sim` copy):**
- On match start, build a local `Sim(seed, mode, playerDefs)` identical to the server's.
- On every authoritative snapshot: `sim.loadSnapshot(snap)` (resets world to truth), re-apply the hero's *standing order*, then `sim.step(DT, true)` a few ticks (PREDICT_LOOKAHEAD ~3) to project ahead of latency. Read back only the local hero pose; render everyone else from interpolated snapshots.
- The renderer only *visually eases* toward that predicted pose (lerp) — it does no simulation itself.

**Why standing order, not just un-acked intents:** snapshots carry hero position but NOT its order/dest. After the last acked move, the server hero keeps walking; if the client only replayed un-acked intents the predicted hero would stop. The client is the sole source of its hero's orders, so it keeps the latest move/attackMove/stop and re-applies it each reconcile.

**The `predict` flag on `Sim.step(dt, predict)`:** when true it skips authority-only RNG systems (bots, creep waves, economy, respawns, cull) and runs only movement/combat/separation. This keeps two client predictions bit-for-bit deterministic and prevents phantom spawns in the local copy. The server always calls `step()` (predict=false) and stays sole authority.

**How to apply:** any future netcode hero/unit prediction goes through `lib/gw-sim` `Sim` + `loadSnapshot` + predict-mode `step`. Do not add movement speed constants or integration loops to the client renderer.
