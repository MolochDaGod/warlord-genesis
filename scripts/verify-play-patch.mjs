import fs from "fs";
const t = fs.readFileSync("assets/index-warlord-fix3.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const checks = {
  v69: t.includes("gw_site_data_cleared_v69"),
  noAuthWipe: !t.includes('"engine_boot_","grudge_"'),
  lobbyCta: t.includes('C("/lobby"),children:"ENTER THE WARCAMP"'),
  quick: t.includes("QUICK BATTLE"),
  stuckGate: t.includes("Still arming"),
  htmlBust: html.includes("v=71"),
};
console.log(checks);
const i = t.indexOf("RETURN TO WARCAMP");
console.log("return", t.slice(Math.max(0, i - 150), i + 60));
