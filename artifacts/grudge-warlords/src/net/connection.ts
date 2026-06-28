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
import { realtimeUrl } from "./url";
import { runtime } from "./runtime";
import { setMp, useMp } from "./mpStore";

let ws: WebSocket | null = null;
let seq = 0;
let helloName: string | undefined;

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
  ws = new WebSocket(realtimeUrl());

  ws.onopen = () => {
    setMp({ status: "connected" });
    if (helloName) send({ t: "hello", name: helloName });
    send({ t: "listRooms" });
  };

  ws.onclose = () => {
    setMp({ status: "disconnected" });
  };

  ws.onerror = () => {
    setMp({ error: "Connection error. Is the match server running?" });
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
}

export function disconnect() {
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  setMp({ status: "disconnected" });
}

function send(msg: ClientMessage) {
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

export const mpCreateRoom = (mode: GameMode) => send({ t: "createRoom", mode });
export const mpJoinRoom = (id: string) => send({ t: "joinRoom", id });
export const mpQuickplay = (mode: GameMode) => send({ t: "quickplay", mode });
export const mpCancelQuickplay = () => send({ t: "cancelQuickplay" });
export const mpLeaveRoom = () => {
  send({ t: "leaveRoom" });
  setMp({ view: "lobby", room: null, queue: null, match: null, snap: null, result: null });
};
export const mpReady = (ready: boolean) => send({ t: "ready", ready });
export const mpStartRoom = () => send({ t: "startRoom" });
export const mpRefreshRooms = () => send({ t: "listRooms" });

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

/** Re-send the current display name (used right before queueing). */
export function mpHello(name: string) {
  send({ t: "hello", name });
}

export function mpConnected(): boolean {
  return useMp.getState().status === "connected";
}
