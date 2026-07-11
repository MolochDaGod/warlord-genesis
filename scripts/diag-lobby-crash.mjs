import fs from "fs";
const t = fs.readFileSync(process.env.TEMP + "/prod-bundle.js", "utf8");

// Find march button disabled / onboarding gate
const keys = [
  "MARCH TO WAR",
  "disabled:!H",
  "disabled:!m",
  "Choose Your Champion",
  "gw-starter-overlay",
  "onboardingDone",
  "completeStarterPick",
];
for (const k of keys) {
  const i = t.indexOf(k);
  console.log(k, i);
  if (i >= 0) console.log(" ", t.slice(Math.max(0, i - 80), i + 120).replace(/\s+/g, " "));
}

// Look for throw/Error near lobby
const i = t.indexOf("The Warcamp");
const chunk = t.slice(i, i + 8000);
// faction access patterns after The Warcamp
console.log("\n--- H.name / playerFaction usage ---");
const re = /H\.[a-zA-Z]+|T\.[a-zA-Z]+/g;
const hits = new Set();
let m;
while ((m = re.exec(chunk)) && hits.size < 30) hits.add(m[0]);
console.log([...hits].join(", "));

// march handler
const j = t.indexOf('children:"MARCH TO WAR"');
console.log("\n--- MARCH btn ---");
console.log(t.slice(j - 250, j + 80));
