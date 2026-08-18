#!/usr/bin/env node
/**
 * Local-only Gemini credential probe for threejs-image-generator.
 * Prints GEMINI_API_KEY=SET|MISSING (and optional auth ping). Never prints the key.
 *
 *   node scripts/gemini-probe.mjs
 *   node scripts/gemini-probe.mjs ping
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function readDotEnv(path) {
  if (!existsSync(path)) return "";
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    return m[1].replace(/^['"]|['"]$/g, "").trim();
  }
  return "";
}

function userEnv(name) {
  try {
    const out = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `[Environment]::GetEnvironmentVariable('${name}','User')`,
      ],
      { encoding: "utf8", windowsHide: true },
    );
    return String(out || "").trim();
  } catch {
    return "";
  }
}

const key =
  process.env.GEMINI_API_KEY ||
  userEnv("GEMINI_API_KEY") ||
  readDotEnv(join(homedir(), ".grok", "gemini.env"));

const status = key ? "SET" : "MISSING";
console.log(`GEMINI_API_KEY=${status}`);

if (process.argv[2] !== "ping") process.exit(key ? 0 : 1);
if (!key) process.exit(1);

const url = "https://generativelanguage.googleapis.com/v1beta/models";
try {
  const res = await fetch(url, { headers: { "x-goog-api-key": key } });
  const body = await res.text();
  let status = "";
  try {
    status = JSON.parse(body)?.error?.status || "";
  } catch {
    status = "";
  }
  if (res.ok) {
    console.log("GEMINI_AUTH=OK");
    process.exit(0);
  }
  const loc = /location is not supported/i.test(body);
  console.log(
    `GEMINI_AUTH=FAIL http=${res.status}${loc ? " location_unsupported" : ""}${status ? ` ${status}` : ""}`,
  );
  process.exit(2);
} catch (err) {
  console.log(`GEMINI_AUTH=FAIL network=${err?.cause?.code || err?.message || "error"}`);
  process.exit(2);
}
