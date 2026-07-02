#!/usr/bin/env node
/** @deprecated Use `npm run verify` — kept for backwards compatibility. */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const res = spawnSync("node", [join(dirname(fileURLToPath(import.meta.url)), "verify-deploy.mjs")], {
  stdio: "inherit",
});
process.exit(res.status ?? 1);