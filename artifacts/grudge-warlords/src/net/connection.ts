// Thin WebSocket client for the realtime lobby/match protocol. Owns the socket,
// dispatches server messages into the zustand UI store + the per-frame runtime,
// and exposes typed senders (including the hero/army intents).

import {
  DT,
  type ClientMessage,
  type GameMode,
  type Intent,
  type ServerMessage,
  type Snapshot,
  type UnitKey,
} from "@workspace/gw-sim";
import { realtimeUrl, resolveRealtimeUrl } from "./url";
import { runtime } from "./runtime";
import { setMp, useMp } from "./mpStore";

let ws: WebSocket | null = null;
let seq = 0;
let helloName: string | undefined;
/** Local offline war-room when match server WebSocket is unavailable. */
let localMode = false;
let localRoomCounter = 1;

// How many ticks the local prediction sim is projected ahead of the last
// authoritative snapshot to mask round-trip latency (~150ms at TICK_HZ=20).
const PREDICT_LOOKAHEAD = 3;

// The controlled hero's standing movement order. The client is the sole source
// of its own hero's orders, so we re-apply the latest one each reconcile to keep
// the predicted hero walking exactly as the server will between snapshots.
let currentOrder: Intent | null = null;

export function connect(name?: string) {
  helloName = name;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    if (name) send({ t: "hello", name });
    return;
  }
  setMp({ status: "connecting", error: null });
  void (async () => {
    const url = await resolveRealtimeUrl().catch(() => realtimeUrl());
    try {
      ws = new WebSocket(url);
    } catch {
      enterLocalLobby("Match server URL invalid — local war rooms available.");
      return;
    }

    let opened = false;
    const failTimer = window.setTimeout(() => {
      if (!opened) {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
        enterLocalLobby(
          "Match server unreachable — create a local war room (bots fill empty seats).",
        );
      }
    }, 4500);

    ws.onopen = () => {
      opened = true;
      window.clearTimeout(failTimer);
      localMode = false;
      setMp({ status: "connected", error: null });
      if (helloName) send({ t: "hello", name: helloName });
      send({ t: "listRooms" });
    };

    ws.onclose = () => {
      window.clearTimeout(failTimer);
      if (!opened && !localMode) {
        enterLocalLobby(
          "Match server offline — create a local war room (bots fill empty seats).",
        );
        return;
      }
      if (!localMode) setMp({ status: "disconnected" });
    };

    ws.onerror = () => {
      // onclose / failTimer handle offline fallback
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch {
        return;
      }
      handle(msg);
    };
  })();
}

function enterLocalLobby(message: string) {
  localMode = true;
  ws = null;
  const id = `local-${Math.random().toString(36).slice(2, 8)}`;
  const name = helloName || "Warlord";
  setMp({
    status: "connected",
    me: { id, name },
    rooms: [],
    room: null,
    queue: null,
    view: "lobby",
    error: message,
  });
}

function capacityFor(mode: GameMode): number {
  return mode === "1v1" ? 2 : mode === "2v2" ? 4 : 6;
}

function createLocalRoom(mode: GameMode) {
  const me = useMp.getState().me;
  if (!me) {
    enterLocalLobby("Local lobby ready.");
  }
  const self = useMp.getState().me!;
  const roomId = `L${localRoomCounter++}`;
  const room = {
    id: roomId,
    mode,
    capacity: capacityFor(mode),
    hostId: self.id,
    state: "lobby" as const,
    players: [
      {
        id: self.id,
        name: self.name,
        ready: true,
        host: true,
        team: 0 as const,
      },
    ],
  };
  setMp({
    room,
    rooms: [
      {
        id: room.id,
        mode: room.mode,
        count: 1,
        capacity: room.capacity,
        state: "lobby",
      },
    ],
    queue: null,
    view: "room",
    error: "Local room — start anytime; bots fill empty seats.",
  });
}

function startLocalMatch() {
  const room = useMp.getState().room;
  const me = useMp.getState().me;
  if (!room || !me) return;
  const mode = room.mode;
  const cap = capacityFor(mode);
  const seed = (Date.now() >>> 0) ^ Math.floor(Math.random() * 1e9);
  // Hand off to single-player battle — same march pipeline, bots vs player.
  // Full authoritative PvP needs the Railway realtime server; local rooms keep lobby usable.
  setMp({
    view: "lobby",
    room: null,
    match: null,
    error: null,
  });
  try {
    sessionStorage.setItem("wg-local-mp-seed", String(seed));
    sessionStorage.setItem("wg-local-mp-mode", mode);
    sessionStorage.setItem("wg-local-mp-capacity", String(cap));
  } catch {
    /* ignore */
  }
  window.location.assign("/play?skirmish=1&mode=" + encodeURIComponent(mode));
}

export function disconnect() {
  localMode = false;
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  setMp({ status: "disconnected" });
}

function send(msg: ClientMessage) {
  if (localMode) return;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function handle(msg: ServerMessage) {
  switch (msg.t) {
    case "welcome":
      setMp({ me: { id: msg.id, name: msg.name } });
      return;
    case "rooms":
      setMp({ rooms: msg.rooms });
      return;
    case "room":
      setMp({ room: msg.room, queue: null, view: "room" });
      return;
    case "queued":
      setMp({ queue: { mode: msg.mode, size: msg.size, need: msg.need }, view: "queued" });
      return;
    case "left":
      setMp({ room: null, queue: null, view: "lobby" });
      return;
    case "matchStart": {
      runtime.reset(msg.slot);
      runtime.initSim(msg.seed, msg.mode, msg.players);
      currentOrder = null;
      setMp({
        match: {
          seed: msg.seed,
          mode: msg.mode,
          mapSize: msg.mapSize,
          slot: msg.slot,
          team: msg.team,
          players: msg.players,
        },
        snap: null,
        result: null,
        view: "match",
      });
      return;
    }
    case "snapshot":
      runtime.push(msg.snap);
      reconcile(msg.snap);
      setMp({ snap: msg.snap });
      return;
    case "matchEnd":
      setMp({ result: msg.winner, view: "result" });
      return;
    case "error":
      setMp({ error: msg.msg });
      return;
    default:
      return;
  }
}

// --- lobby actions ---

export const mpCreateRoom = (mode: GameMode) => {
  if (localMode || useMp.getState().status !== "connected" || !ws || ws.readyState !== WebSocket.OPEN) {
    if (!localMode) enterLocalLobby("Using local war rooms (server offline).");
    createLocalRoom(mode);
    return;
  }
  send({ t: "createRoom", mode });
};
export const mpJoinRoom = (id: string) => {
  if (localMode) {
    setMp({ error: "Local rooms cannot be joined from another browser. Create your own." });
    return;
  }
  send({ t: "joinRoom", id });
};
export const mpQuickplay = (mode: GameMode) => {
  if (localMode || !ws || ws.readyState !== WebSocket.OPEN) {
    createLocalRoom(mode);
    return;
  }
  send({ t: "quickplay", mode });
};
export const mpCancelQuickplay = () => {
  if (localMode) {
    setMp({ queue: null, view: "lobby" });
    return;
  }
  send({ t: "cancelQuickplay" });
};
export const mpLeaveRoom = () => {
  if (!localMode) send({ t: "leaveRoom" });
  setMp({ view: "lobby", room: null, queue: null, match: null, snap: null, result: null });
};
export const mpReady = (ready: boolean) => {
  if (localMode) {
    const room = useMp.getState().room;
    const me = useMp.getState().me;
    if (!room || !me) return;
    setMp({
      room: {
        ...room,
        players: room.players.map((p) => (p.id === me.id ? { ...p, ready } : p)),
      },
    });
    return;
  }
  send({ t: "ready", ready });
};
export const mpStartRoom = () => {
  if (localMode) {
    startLocalMatch();
    return;
  }
  send({ t: "startRoom" });
};
export const mpRefreshRooms = () => {
  if (localMode) {
    const room = useMp.getState().room;
    setMp({
      rooms: room
        ? [
            {
              id: room.id,
              mode: room.mode,
              count: room.players.length,
              capacity: room.capacity,
              state: room.state,
            },
          ]
        : [],
    });
    return;
  }
  send({ t: "listRooms" });
};

// --- match intents ---

function intent(i: Intent) {
  send({ t: "intent", intent: i, seq: ++seq });
}

// Reset the local prediction sim to the authoritative snapshot, re-apply the
// hero's standing order, then run the SAME deterministic step() a few ticks to
// project the controlled hero ahead of the last snapshot. Only the local hero is
// read back; all other entities are rendered from interpolated snapshots.
function reconcile(snap: Snapshot) {
  const sim = runtime.predictSim;
  if (!sim) return;
  sim.loadSnapshot(snap);
  if (currentOrder) sim.pushIntent(runtime.slot, currentOrder);
  for (let i = 0; i < PREDICT_LOOKAHEAD; i++) sim.step(DT, true);
  const h = sim.heroState(runtime.slot);
  if (h) {
    runtime.predict = { has: true, x: h.x, z: h.z, yaw: h.yaw };
  } else {
    runtime.predict.has = false;
    currentOrder = null;
  }
}

// Set a new standing order and immediately re-predict against the freshest
// snapshot so the local hero responds this frame instead of after the next one.
function applyOrder(order: Intent) {
  currentOrder = order;
  intent(order);
  const latest = runtime.latest();
  if (latest) reconcile(latest);
}

export function mpMove(x: number, z: number) {
  applyOrder({ k: "move", x, z });
}

export function mpAttackMove(x: number, z: number) {
  applyOrder({ k: "attackMove", x, z });
}

export function mpStop() {
  applyOrder({ k: "stop" });
}

export function mpSummon(unit: UnitKey, lane: number) {
  intent({ k: "summon", unit, lane });
}

/** Tell ally bots which lane to reinforce (also sets your rally lane). */
export function mpRally(lane: number) {
  intent({ k: "rally", lane });
}

/** Re-send the current display name (used right before queueing). */
export function mpHello(name: string) {
  send({ t: "hello", name });
}

export function mpConnected(): boolean {
  return useMp.getState().status === "connected";
}
