import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../src/data/heroCodexSite.json");
const CODEX_ORIGIN = "https://grudge-heros.puter.site";

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

const html = await fetchHtml(`${CODEX_ORIGIN}/`);
const match = html.match(/const HEROES = (\[[\s\S]*?\]);/);
if (!match) throw new Error("HEROES array not found on codex page");

let raw = match[1]
  .replace(/stats:\s*ds\([^)]*\)/g, "stats:null")
  .replace(/stats:\(function\(\)\{[\s\S]*?\}\)\(\)/g, "stats:null");
// eslint-disable-next-line no-eval
const heroes = eval(raw);

const loadoutMatch = html.match(/const CANONICAL_LOADOUTS = (\{[\s\S]*?\});/);
if (loadoutMatch) {
  // eslint-disable-next-line no-eval
  const canonical = eval("(" + loadoutMatch[1] + ")");
  for (const h of heroes) {
    const c = canonical[h.id];
    if (!c) continue;
    h.weapons = c.weapons;
    h.combatStyle = c.combatStyle;
    h.loadoutShort = c.loadoutShort;
  }
}

const payload = {
  source: `${CODEX_ORIGIN}/`,
  fetchedAt: new Date().toISOString(),
  count: heroes.length,
  heroes,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(`Wrote ${heroes.length} heroes → ${OUT}`);