import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachRealtime } from "./realtime";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Wrap Express in an explicit HTTP server so the realtime WebSocket layer can
// claim `upgrade` requests on /api/realtime while normal HTTP keeps flowing.
const server = createServer(app);
attachRealtime(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
