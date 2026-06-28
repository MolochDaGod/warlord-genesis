import type { WebSocket } from "ws";
import type { ServerMessage } from "@workspace/gw-sim";
import type { Room } from "./room";

let counter = 0;

/** A single connected socket. Lives in at most one place: free, a queue, or a room. */
export class Client {
  readonly id: string;
  name: string;
  readonly ws: WebSocket;
  /** The room this client is seated in, if any. */
  room: Room | null = null;
  /** The seat slot inside that room. */
  slot = -1;
  /** Mode this client is queued for, if waiting in quickplay. */
  queuedMode: "1v1" | "2v2" | null = null;

  constructor(ws: WebSocket, name: string) {
    this.id = `c${(++counter).toString(36)}${Date.now().toString(36).slice(-4)}`;
    this.ws = ws;
    this.name = name;
  }

  send(msg: ServerMessage) {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
