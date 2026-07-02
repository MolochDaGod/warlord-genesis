import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const j = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "index-warlord-fix3.js"),
  "utf8",
);

const checks = [
  ["PQ proxy", 'PQ="/api/assets"'],
  ["Puter sign-in", "async function WgPuterSignIn"],
  ["Auto guest restore", "const g=await lO()"],
  ["signInWithPuter", "signInWithPuter:()=>xR(C,WgPuterSignIn)"],
  ["Puter button", "SIGN IN WITH PUTER"],
  ["Gbux effect fix", "zC.getState().syncGbuxFromAccount(v)"],
  ["Token persist", "g?.token&&cq(g.token)"],
  ["Bearer /me", "Authorization:`Bearer ${C}`"],
];

for (const [label, needle] of checks) {
  console.log(`${label}:`, j.includes(needle));
}