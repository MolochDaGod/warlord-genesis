import { readFileSync, writeFileSync } from "fs";
const p = "assets/index-BNWYZMT1.css";
let c = readFileSync(p, "utf8");
if (!c.includes(".wg-path-grid")) {
  c += `
.wg-path-grid{display:flex;flex-direction:column;gap:10px}
.wg-path-row{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;background:rgba(6,9,14,.7);border:1px solid rgba(120,150,200,.18)}
.wg-path-row>strong{font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:#9dffd8}
.wg-path-opts{display:flex;flex-wrap:wrap;gap:6px}
.wg-path-opts .gw-btn-mini{max-width:100%;text-align:left;line-height:1.25;padding:8px 10px}
.wg-path-opts .gw-btn-mini.gw-active{border-color:rgba(224,178,82,.75)!important;background:rgba(224,178,82,.16)!important;color:#f0e6d0!important}
`;
  writeFileSync(p, c);
  console.log("appended");
} else console.log("ok");
