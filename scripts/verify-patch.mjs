import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const j = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "index-warlord-fix3.js"),
  "utf8",
);

const checks = [
  ["PQ proxy", 'PQ="/api/assets"'],
  ["Fleet auth base", 'GN="/api/auth"'],
  ["Guest via puter", 'nO("/puter",{puterId:p,displayName:"Guest"})'],
  ["Puter sign-in", "async function WgPuterSignIn"],
  ["Auto guest restore", "const g=await lO()"],
  ["signInWithPuter", "signInWithPuter:()=>xR(C,WgPuterSignIn)"],
  ["Puter button", "SIGN IN WITH PUTER"],
  ["Gbux effect fix", "zC.getState().syncGbuxFromAccount(v)"],
  ["Token persist", "g.token||g.sessionToken"],
  ["Bearer /me", "Authorization:`Bearer ${C}`"],
  ["Fleet kO", "const I=await cO()"],
  ["Sync Bearer", "WgFleetSync(C){try{const tok=SO()"],
  ["Title v3 layout", "gw-screen gw-title-v3"],
  ["Visible Puter auth", "Sign in with Puter"],
  ["Title play CTA", "Enter the Warcamp"],
];

for (const [label, needle] of checks) {
  console.log(`${label}:`, j.includes(needle));
}