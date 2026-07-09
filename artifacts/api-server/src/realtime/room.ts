import {
  MAP_SIZES,
  modeCapacity,
  Sim,
  TICK_HZ,
  type GameMode,
  type Intent,
  type PlayerDef,
  type RoomDetail,
  type RoomPlayerInfo,
  type Team,
} from "@workspace/gw-sim";
import { logger } from "../lib/logger";
import type { Client } from "./client";

interface Seat {
  client: Client | null;
  slot: number;
  team: Team;
  ready: boolean;
  lastSeq: number;
  /** Display name captured at seating (kept if the client later disconnects). */
  name: string;
}

export interface RoomHost {
  /** Called when a room becomes empty so the lobby can drop it. */
  onRoomEmpty(room: Room): void;
  /** Called when a client should be returned to the lobby view. */
  onClientToLobby(client: Client): void;
  /** Called whenever room membership changes so lobby listings refresh. */
  onRoomsChanged(): void;
}

export class Room {
  readonly id: string;
  readonly mode: GameMode;
  readonly capacity: number;
  hostId = "";
  state: "lobby" | "playing" = "lobby";
  private seats: Seat[];
  private sim: Sim | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private host: RoomHost;

  constructor(id: string, mode: GameMode, host: RoomHost) {
    this.id = id;
    this.mode = mode;
    this.capacity = modeCapacity(mode);
    this.host = host;
    const half = this.capacity / 2;
    this.seats = [];
    for (let i = 0; i < this.capacity; i++) {
      this.seats.push({
        client: null,
        slot: i,
        team: (i < half ? 0 : 1) as Team,
        ready: false,
        lastSeq: 0,
        name: `Bot ${i + 1}`,
      });
    }
  }

  get playerCount(): number {
    return this.seats.filter((s) => s.client).length;
  }

  isFull(): boolean {
    return this.playerCount >= this.capacity;
  }

  /** Seat a client. Returns false if there is no room. */
  add(client: Client): boolean {
    if (this.state !== "lobby") return false;
    const seat = this.seats.find((s) => !s.client);
    if (!seat) return false;
    seat.client = client;
    seat.name = client.name;
    seat.ready = false;
    client.room = this;
    client.slot = seat.slot;
    if (!this.hostId) this.hostId = client.id;
    this.broadcastRoom();
    this.host.onRoomsChanged();
    // Auto-start once a full lobby of humans is present.
    if (this.isFull()) this.start();
    return true;
  }

  setReady(client: Client, ready: boolean) {
    const seat = this.seats.find((s) => s.client === client);
    if (!seat) return;
    seat.ready = ready;
    this.broadcastRoom();
  }

  /** Host forces the match to begin, filling empty seats with bots. */
  requestStart(client: Client) {
    if (client.id !== this.hostId) return;
    if (this.state !== "lobby") return;
    if (this.playerCount < 1) return;
    this.start();
  }

  remove(client: Client) {
    const seat = this.seats.find((s) => s.client === client);
    if (!seat) return;
    seat.client = null;
    client.room = null;
    client.slot = -1;
    if (this.state === "playing" && this.sim) {
      this.sim.setConnected(seat.slot, false);
      this.checkForfeit();
    }
    if (this.hostId === client.id) {
      const next = this.seats.find((s) => s.client);
      this.hostId = next?.client?.id ?? "";
    }
    if (this.playerCount === 0) {
      this.destroy();
      this.host.onRoomEmpty(this);
    } else if (this.state === "lobby") {
      this.broadcastRoom();
    }
    this.host.onRoomsChanged();
  }

  handleIntent(client: Client, intent: Intent, seq: number) {
    if (this.state !== "playing" || !this.sim) return;
    const seat = this.seats.find((s) => s.client === client);
    if (!seat) return;
    if (seq > seat.lastSeq) seat.lastSeq = seq;
    this.sim.pushIntent(seat.slot, intent);
  }

  // --- lifecycle ---

  private start() {
    if (this.state === "playing") return;
    this.state = "playing";
    const seed = (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
    const defs: PlayerDef[] = this.seats.map((s) => ({
      slot: s.slot,
      team: s.team,
      name: s.client ? s.client.name : s.name,
      bot: !s.client,
    }));
    this.sim = new Sim(seed, this.mode, defs);
    const initial = this.sim.snapshot();
    const size = MAP_SIZES[this.mode];

    for (const seat of this.seats) {
      if (!seat.client) continue;
      seat.client.send({
        t: "matchStart",
        seed,
        mode: this.mode,
        mapSize: { w: size.w, l: size.l },
        slot: seat.slot,
        team: seat.team,
        players: initial.players,
      });
    }

    logger.info({ room: this.id, mode: this.mode, seed }, "realtime: match started");
    this.host.onRoomsChanged();

    const intervalMs = 1000 / TICK_HZ;
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  private tick() {
    if (!this.sim) return;
    this.sim.step();
    const snap = this.sim.snapshot();
    for (const seat of this.seats) {
      if (!seat.client) continue;
      seat.client.send({ t: "snapshot", snap, ack: seat.lastSeq });
    }
    if (this.sim.phase === "ended") {
      this.end(this.sim.winner);
    }
  }

  private checkForfeit() {
    if (!this.sim || this.state !== "playing") return;
    const t0 = this.sim.teamHasConnectedHuman(0);
    const t1 = this.sim.teamHasConnectedHuman(1);
    if (!t0 && !t1) {
      // Nobody left to watch — just tear the match down.
      this.destroy();
      this.host.onRoomEmpty(this);
      return;
    }
    if (!t0 && t1) this.sim.forceWin(1);
    else if (t0 && !t1) this.sim.forceWin(0);
  }

  private end(winner: Team | null) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const w: Team = winner ?? 0;
    for (const seat of this.seats) {
      if (seat.client) seat.client.send({ t: "matchEnd", winner: w });
    }
    this.state = "lobby";
    this.sim = null;
    // Reset seats; survivors will be sent back to the lobby by the UI (leaveRoom).
    logger.info({ room: this.id, winner: w }, "realtime: match ended");
    this.host.onRoomsChanged();
  }

  private destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.sim = null;
    this.state = "lobby";
    for (const seat of this.seats) {
      if (seat.client) {
        seat.client.room = null;
        seat.client.slot = -1;
      }
      seat.client = null;
    }
  }

  detail(): RoomDetail {
    const players: RoomPlayerInfo[] = this.seats
      .filter((s) => s.client)
      .map((s) => ({
        id: s.client!.id,
        name: s.client!.name,
        ready: s.ready,
        host: s.client!.id === this.hostId,
        team: s.team,
      }));
    return {
      id: this.id,
      mode: this.mode,
      capacity: this.capacity,
      hostId: this.hostId,
      state: this.state,
      players,
    };
  }

  private broadcastRoom() {
    const detail = this.detail();
    for (const seat of this.seats) {
      if (seat.client) seat.client.send({ t: "room", room: detail });
    }
  }
}
