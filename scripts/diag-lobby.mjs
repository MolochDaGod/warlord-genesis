import fs from "fs";

const path = process.argv[2] || `${process.env.TEMP}/ws-lobby-bundle.js`;
const t = fs.readFileSync(path, "utf8");

const needles = [
  'path:"/lobby"',
  "path:'/lobby'",
  "/lobby",
  "The Warcamp",
  "MARCH TO WAR",
  "WgEnsureReady",
  "onboardingDone",
  "StarterPick",
  "gw_site_data_cleared_v68",
  "gw_site_data_cleared_v69",
  '"grudge_","puter"',
  "ENTER THE WARCAMP",
  "QUICK BATTLE",
  "Still arming",
  "Cannot enter battle",
  "gk-warcamp-shell",
  "function WgLobby",
  "ensureWarcampReady",
  "PREFAB_BY_ID",
];

for (const n of needles) {
  console.log(String(t.includes(n)).padEnd(5), n);
}

// Route table snippet
const markers = ['path:"/lobby"', 'path:"/play"', 'path:"/deploy"', 'path:"/"'];
for (const m of markers) {
  const i = t.indexOf(m);
  console.log("\n---", m, "at", i);
  if (i >= 0) console.log(t.slice(Math.max(0, i - 100), i + 180).replace(/\s+/g, " "));
}

// Intro CTA
const j = t.indexOf("ENTER THE WARCAMP");
console.log("\n--- INTRO CTA ---");
console.log(t.slice(Math.max(0, j - 150), j + 200).replace(/\s+/g, " "));
