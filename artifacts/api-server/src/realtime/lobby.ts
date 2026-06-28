import type {
  ClientMessage,
  GameMode,
  RoomInfo,
} from "@workspace/gw-sim";
import { logger } from "../lib/logger";
import { Client } from "./client";
import { Room, type RoomHost } from "./room";

const MODES: GameMode[] = ["1v1", "2v2"];

function roomCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

/** Owns all connected clients, the open rooms, and the quickplay queues. */
export class Lobby implements RoomHost {
  private clients = new Set<Client>();
  private rooms = new Map<string, Room>();
  private queues: Record<GameMode, Client[]> = { "1v1": [], "2v2": [] };

  addClient(client: Client) {
    this.clients.add(client);
    client.send({ t: "welcome", id: client.id, name: client.name });
    this.sendRooms(client);
  }

  removeClient(client: Client) {
    this.detach(client);
    this.clients.delete(client);
  }

  handle(client: Client, msg: ClientMessage) {
    switch (msg.t) {
      case "hello": {
        if (typeof msg.name === "string" && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 24);
        }
        client.send({ t: "welcome", id: client.id, name: client.name });
        return;
      }
      case "listRooms":
        this.sendRooms(client);
        return;
      case "createRoom": {
        if (!MODES.includes(msg.mode)) return;
        this.detach(client);
        const room = new Room(roomCode(), msg.mode, this);
        this.rooms.set(room.id, room);
        room.add(client);
        this.broadcastRooms();
        return;
      }
      case "joinRoom": {
        const room = this.rooms.get(msg.id);
        if (!room || room.state !== "lobby" || room.isFull()) {
          client.send({ t: "error", msg: "That room is unavailable." });
          return;
        }
        this.detach(client);
        room.add(client);
        return;
      }
      case "quickplay": {
        if (!MODES.includes(msg.mode)) return;
        this.detach(client);
        this.queues[msg.mode].push(client);
        client.queuedMode = msg.mode;
        this.tryMatch(msg.mode);
        if (client.queuedMode) {
          const cap = msg.mode === "1v1" ? 2 : 4;
          client.send({
            t: "queued",
            mode: msg.mode,
            size: this.queues[msg.mode].length,
            need: cap,
          });
        }
        return;
      }
      case "cancelQuickplay":
        this.dequeue(client);
        client.send({ t: "left" });
        return;
      case "leaveRoom": {
        this.detach(client);
        client.send({ t: "left" });
        this.sendRooms(client);
        return;
      }
      case "ready":
        client.room?.setReady(client, !!msg.ready);
        return;
      case "startRoom":
        client.room?.requestStart(client);
        return;
      case "intent":
        client.room?.handleIntent(client, msg.intent, msg.seq | 0);
        return;
      default:
        return;
    }
  }

  // --- matchmaking ---

  private tryMatch(mode: GameMode) {
    const cap = mode === "1v1" ? 2 : 4;
    const q = this.queues[mode];
    while (q.length >= cap) {
      const group = q.splice(0, cap);
      const room = new Room(roomCode(), mode, this);
      this.rooms.set(room.id, room);
      for (const c of group) {
        c.queuedMode = null;
        room.add(c);
      }
      logger.info({ room: room.id, mode }, "realtime: quickplay matched");
    }
  }

  private dequeue(client: Client) {
    if (!client.queuedMode) return;
    const q = this.queues[client.queuedMode];
    const i = q.indexOf(client);
    if (i >= 0) q.splice(i, 1);
    client.queuedMode = null;
  }

  /** Remove a client from whatever it is currently part of (queue or room). */
  private detach(client: Client) {
    this.dequeue(client);
    if (client.room) client.room.remove(client);
  }

  // --- RoomHost ---

  onRoomEmpty(room: Room) {
    this.rooms.delete(room.id);
    this.broadcastRooms();
  }

  onClientToLobby(client: Client) {
    this.sendRooms(client);
  }

  onRoomsChanged() {
    this.broadcastRooms();
  }

  // --- room listings ---

  private roomList(): RoomInfo[] {
    const list: RoomInfo[] = [];
    for (const room of this.rooms.values()) {
      list.push({
        id: room.id,
        mode: room.mode,
        count: room.playerCount,
        capacity: room.capacity,
        state: room.state,
      });
    }
    return list;
  }

  private sendRooms(client: Client) {
    client.send({ t: "rooms", rooms: this.roomList() });
  }

  private broadcastRooms() {
    const rooms = this.roomList();
    for (const client of this.clients) {
      if (!client.room) client.send({ t: "rooms", rooms });
    }
  }
}
