#!/usr/bin/env node
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const bundle = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "index-warlord-fix3.js");
try {
  execSync(`npx --yes esbuild "${bundle}" --bundle --outfile=NUL`, {
    stdio: "pipe",
    shell: true,
  });
  console.log("[esbuild] syntax OK");
} catch (e) {
  console.error("[esbuild] bundle parse FAILED");
  console.error(String(e.stderr || e.stdout || e.message));
  process.exit(1);
}