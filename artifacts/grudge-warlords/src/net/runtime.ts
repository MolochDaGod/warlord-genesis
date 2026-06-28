// Per-frame networking runtime kept OUTSIDE React so the 3D scene can read it in
// useFrame without triggering re-renders. Holds a small ring of recent snapshots
// for entity interpolation and a LOCAL copy of the shared deterministic `Sim`
// used to predict the controlled hero (see connection.ts `reconcile`).

import { Sim, type GameMode, type NetPlayer, type Snapshot } from "@workspace/gw-sim";

interface Buffered {
  snap: Snapshot;
  /** client-clock arrival time (performance.now) */
  at: number;
}

/** Latest predicted pose of the controlled hero, produced by the shared Sim. */
export interface HeroPredict {
  has: boolean;
  x: number;
  z: number;
  yaw: number;
}

class NetRuntime {
  buffer: Buffered[] = [];
  /** our player slot in the active match */
  slot = -1;
  /** local copy of the authoritative sim, advanced a few ticks for prediction */
  predictSim: Sim | null = null;
  predict: HeroPredict = { has: false, x: 0, z: 0, yaw: 0 };

  reset(slot: number) {
    this.buffer = [];
    this.slot = slot;
    this.predictSim = null;
    this.predict = { has: false, x: 0, z: 0, yaw: 0 };
  }

  /** Build the local prediction sim from the match parameters. */
  initSim(seed: number, mode: GameMode, players: NetPlayer[]) {
    this.predictSim = new Sim(
      seed,
      mode,
      players.map((p) => ({ slot: p.slot, team: p.team, name: p.name, bot: p.bot })),
    );
  }

  push(snap: Snapshot) {
    this.buffer.push({ snap, at: performance.now() });
    if (this.buffer.length > 8) this.buffer.shift();
  }

  latest(): Snapshot | null {
    const b = this.buffer[this.buffer.length - 1];
    return b ? b.snap : null;
  }

  /** Two snapshots bracketing a render time = now - delay (ms), with t in [0,1]. */
  sampleAt(delayMs: number): { a: Snapshot; b: Snapshot; t: number } | null {
    if (this.buffer.length === 0) return null;
    const renderAt = performance.now() - delayMs;
    if (this.buffer.length === 1) {
      const only = this.buffer[0]!.snap;
      return { a: only, b: only, t: 0 };
    }
    for (let i = this.buffer.length - 1; i > 0; i--) {
      const newer = this.buffer[i]!;
      const older = this.buffer[i - 1]!;
      if (older.at <= renderAt && renderAt <= newer.at) {
        const span = newer.at - older.at || 1;
        return { a: older.snap, b: newer.snap, t: (renderAt - older.at) / span };
      }
    }
    // renderAt older than everything we have -> clamp to oldest.
    const oldest = this.buffer[0]!.snap;
    return { a: oldest, b: oldest, t: 0 };
  }
}

export const runtime = new NetRuntime();

/** Interpolation delay: ~1.5 snapshot intervals at 20Hz keeps motion smooth. */
export const INTERP_DELAY_MS = 90;
