import { create } from "zustand";
import type {
  GameMode,
  NetPlayer,
  RoomDetail,
  RoomInfo,
  Snapshot,
  Team,
} from "@workspace/gw-sim";

export type MpView = "lobby" | "queued" | "room" | "match" | "result";

export interface MatchInfo {
  seed: number;
  mode: GameMode;
  mapSize: { w: number; l: number };
  slot: number;
  team: Team;
  players: NetPlayer[];
}

interface MpState {
  status: "disconnected" | "connecting" | "connected";
  me: { id: string; name: string } | null;
  view: MpView;
  rooms: RoomInfo[];
  room: RoomDetail | null;
  queue: { mode: GameMode; size: number; need: number } | null;
  match: MatchInfo | null;
  /** latest snapshot mirrored for HUD/scoreboard rendering */
  snap: Snapshot | null;
  result: Team | null;
  error: string | null;
}

export const useMp = create<MpState>(() => ({
  status: "disconnected",
  me: null,
  view: "lobby",
  rooms: [],
  room: null,
  queue: null,
  match: null,
  snap: null,
  result: null,
  error: null,
}));

export const setMp = (partial: Partial<MpState>) => useMp.setState(partial);
