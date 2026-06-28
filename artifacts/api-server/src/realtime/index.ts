// Authoritative realtime layer for PvP matches. A single WebSocketServer is
// attached to the existing HTTP server via the `upgrade` event and only claims
// connections on the dedicated `/api/realtime` path — so the whole product ships
// as one deploy on one domain (HTTP API + game sockets share the port).

import type { Server } from "node:http";
import type { Duplex } from "node:stream";
import type { IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientMessage } from "@workspace/gw-sim";
import { logger } from "../lib/logger";
import { Client } from "./client";
import { Lobby } from "./lobby";
import { identityFromCookies, resolveName } from "./auth";

const REALTIME_PATH = "/api/realtime";

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const lobby = new Lobby();

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    let pathname = "";
    try {
      pathname = new URL(req.url ?? "", "http://localhost").pathname;
    } catch {
      pathname = req.url ?? "";
    }
    if (pathname !== REALTIME_PATH) {
      // Not ours — let any other upgrade handler (or default) deal with it.
      return;
    }
    const identity = identityFromCookies(req.headers.cookie);
    wss.handleUpgrade(req, socket, head, (ws) => {
      void onConnection(ws, identity.userId, lobby);
    });
  });

  logger.info({ path: REALTIME_PATH }, "realtime: websocket attached");
}

async function onConnection(ws: WebSocket, userId: number | null, lobby: Lobby) {
  const resolved = await resolveName(userId);
  const fallback = `Warlord ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const client = new Client(ws, resolved ?? fallback);
  lobby.addClient(client);

  ws.on("message", (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof data === "string" ? data : data.toString()) as ClientMessage;
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== "string") return;
    try {
      lobby.handle(client, msg);
    } catch (err) {
      logger.error({ err, type: msg.t }, "realtime: message handler failed");
    }
  });

  ws.on("close", () => lobby.removeClient(client));
  ws.on("error", () => lobby.removeClient(client));
}
