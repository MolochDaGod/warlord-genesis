import fs from "fs";
const path = process.argv[2] || `${process.env.TEMP}/live-fix3.js`;
const t = fs.readFileSync(path, "utf8");
console.log({
  len: t.length,
  v69: t.includes("gw_site_data_cleared_v69"),
  v68: t.includes("gw_site_data_cleared_v68"),
  quick: t.includes("QUICK BATTLE"),
  stillArming: t.includes("Still arming"),
  authWipe: t.includes('"grudge_","puter"'),
  cdnProxy: t.includes('PQ="/api/assets"'),
  ensureReady: t.includes("WgEnsureReady"),
  playBoot: t.includes("Checking systems"),
  lobby: t.includes('C("/lobby"),children:"ENTER THE WARCAMP"'),
});
