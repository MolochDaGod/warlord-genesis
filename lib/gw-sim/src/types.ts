// Network DTOs + intent/protocol types shared by client and server. Kept small
// (short field names) because full snapshots are broadcast every tick.

import type { StructKey, UnitKey } from "./config";

export type Team = 0 | 1;
export type GameMode = "1v1" | "2v2";

export type MatchPhase = "playing" | "ended";

/** A networked unit (hero, creep, or summoned soldier). */
export interface NetUnit {
  id: number;
  t: Team;
  /** unit archetype key */
  k: UnitKey;
  hp: number;
  mhp: number;
  x: number;
  z: number;
  /** facing yaw in radians */
  y: number;
  /** owner player slot, or -1 for neutral lane creeps */
  o: number;
  /** is this a player hero */
  h: boolean;
  /** 1 while actively attacking this tick (drives swing FX), else 0 */
  a: number;
}

export interface NetStruct {
  id: number;
  t: Team;
  k: StructKey;
  hp: number;
  mhp: number;
  x: number;
  z: number;
}

export interface NetPlayer {
  slot: number;
  team: Team;
  name: string;
  credits: number;
  /** hero entity id (for camera/lookup), or -1 if dead */
  heroId: number;
  alive: boolean;
  /** seconds until respawn (0 if alive) */
  respawn: number;
  connected: boolean;
  bot: boolean;
  kills: number;
}

export interface Snapshot {
  tick: number;
  phase: MatchPhase;
  winner: Team | null;
  players: NetPlayer[];
  units: NetUnit[];
  structs: NetStruct[];
}

// --- Player intents (client -> server, applied authoritatively) ---

export type Intent =
  | { k: "move"; x: number; z: number }
  | { k: "attackMove"; x: number; z: number }
  | { k: "stop" }
  | { k: "summon"; unit: UnitKey; lane: number }
  | { k: "rally"; lane: number };

// --- Lobby / room descriptors ---

export interface RoomPlayerInfo {
  id: string;
  name: string;
  ready: boolean;
  host: boolean;
  team: Team;
}

export interface RoomInfo {
  id: string;
  mode: GameMode;
  count: number;
  capacity: number;
  state: "lobby" | "playing";
}

export interface RoomDetail {
  id: string;
  mode: GameMode;
  capacity: number;
  hostId: string;
  state: "lobby" | "playing";
  players: RoomPlayerInfo[];
}

// --- WebSocket protocol ---

export type ClientMessage =
  | { t: "hello"; name?: string }
  | { t: "listRooms" }
  | { t: "createRoom"; mode: GameMode }
  | { t: "joinRoom"; id: string }
  | { t: "quickplay"; mode: GameMode }
  | { t: "cancelQuickplay" }
  | { t: "leaveRoom" }
  | { t: "ready"; ready: boolean }
  | { t: "startRoom" }
  | { t: "intent"; intent: Intent; seq: number };

export type ServerMessage =
  | { t: "welcome"; id: string; name: string }
  | { t: "rooms"; rooms: RoomInfo[] }
  | { t: "room"; room: RoomDetail }
  | { t: "queued"; mode: GameMode; size: number; need: number }
  | { t: "left" }
  | {
      t: "matchStart";
      seed: number;
      mode: GameMode;
      mapSize: { w: number; l: number };
      slot: number;
      team: Team;
      players: NetPlayer[];
    }
  | { t: "snapshot"; snap: Snapshot; ack: number }
  | { t: "matchEnd"; winner: Team }
  | { t: "error"; msg: string };
