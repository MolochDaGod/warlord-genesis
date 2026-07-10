import { readFileSync, writeFileSync } from "fs";

const cssPath = "assets/index-BNWYZMT1.css";
let css = readFileSync(cssPath, "utf8");

const block = `
/* v70 pregame war council — full board: path + deploy + load */
.wg-pregame{position:relative;min-height:100dvh;overflow:auto;color:#e8eef8;font-family:Inter,system-ui,sans-serif}
.wg-pregame-bg{position:fixed;inset:0;z-index:0;background:
  radial-gradient(ellipse 90% 55% at 50% -10%,rgba(224,178,82,.14),transparent 55%),
  radial-gradient(ellipse 60% 40% at 100% 100%,rgba(80,120,200,.08),transparent 50%),
  #070b12}
.wg-pregame-shell{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:18px 16px 28px;display:flex;flex-direction:column;gap:14px}
.wg-pregame-head{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;align-items:stretch}
@media(max-width:900px){.wg-pregame-head{grid-template-columns:1fr}}
.wg-pregame-brand{display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:14px;border:1px solid rgba(120,150,200,.22);background:rgba(10,14,22,.88);box-shadow:0 12px 40px rgba(0,0,0,.35)}
.wg-pregame-brand img{width:48px;height:48px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5))}
.wg-pregame-kicker{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#9dffd8;margin-bottom:4px}
.wg-pregame-brand h1{margin:0;font-family:Cinzel,serif;font-size:1.45rem;color:#f0e6d0;letter-spacing:.04em}
.wg-pregame-hero{display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:14px;border:1px solid rgba(224,178,82,.28);background:linear-gradient(135deg,rgba(20,16,10,.92),rgba(8,12,20,.9))}
.wg-pregame-hero img{width:40px;height:40px;object-fit:contain}
.wg-pregame-hero strong{display:block;font-family:Cinzel,serif;color:#f0e6d0;font-size:1.05rem}
.wg-pregame-hero span{font-size:.82rem;color:#a8b8d0}
.wg-pregame-load{grid-column:1/-1;padding:12px 14px;border-radius:12px;border:1px solid rgba(120,150,200,.2);background:rgba(6,9,14,.82)}
.wg-pregame-bar{height:12px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(120,150,200,.2);overflow:hidden;margin-bottom:8px}
.wg-pregame-bar>i{display:block;height:100%;background:linear-gradient(90deg,#5ad48a,#e0b252,#f0e6d0);border-radius:999px;transition:width .28s ease;box-shadow:0 0 12px rgba(224,178,82,.35)}
.wg-pregame-load-meta{display:flex;flex-wrap:wrap;gap:10px 16px;font-size:.82rem;color:#a8b8d0}
.wg-pregame-load-meta .is-ok{color:#9dffd8;font-weight:600}
.wg-pregame-err{margin:0;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,120,90,.35);background:rgba(40,12,8,.75);color:#ffb4a8;font-size:.88rem}
.wg-pregame-tabs{display:flex;flex-wrap:wrap;gap:8px}
.wg-pregame-tabs button{appearance:none;border:1px solid rgba(120,150,200,.28);background:rgba(8,12,20,.75);color:#a8b8d0;border-radius:999px;padding:8px 14px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;font-family:inherit}
.wg-pregame-tabs button.is-on{border-color:rgba(224,178,82,.65);background:rgba(224,178,82,.14);color:#f0e6d0}
.wg-pregame-board{display:grid;gap:14px}
.wg-pregame-board.is-split{grid-template-columns:1.15fr 1fr}
@media(max-width:960px){.wg-pregame-board.is-split{grid-template-columns:1fr}}
.wg-pregame-panel{border-radius:14px;border:1px solid rgba(120,150,200,.24);background:rgba(10,14,22,.92);box-shadow:0 14px 40px rgba(0,0,0,.4);overflow:hidden;display:flex;flex-direction:column;min-height:0}
.wg-pregame-panel-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;background-size:100% 100%;background-color:rgba(12,16,24,.95);border-bottom:1px solid rgba(120,150,200,.18)}
.wg-pregame-panel-head h2{margin:0;font-family:Cinzel,serif;font-size:1.05rem;color:#f0e6d0;letter-spacing:.06em}
.wg-pregame-panel-head span{font-size:.78rem;color:#9dffd8;letter-spacing:.04em}
.wg-pregame-lead{margin:0;padding:10px 16px 0;font-size:.86rem;color:#a8b8d0;line-height:1.45}
.wg-pregame-sub{padding:12px 16px;border-top:1px solid rgba(120,150,200,.12)}
.wg-pregame-sub h3{margin:0 0 8px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#e0c878}
.wg-path-grid{display:flex;flex-direction:column;gap:10px;padding:12px 14px 16px;max-height:min(58vh,640px);overflow:auto}
.wg-path-row{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:rgba(6,9,14,.72);border:1px solid rgba(120,150,200,.16)}
.wg-path-row.is-picked{border-color:rgba(110,231,183,.35);box-shadow:inset 0 0 0 1px rgba(110,231,183,.08)}
.wg-path-row-top{display:flex;justify-content:space-between;align-items:center}
.wg-path-row-top strong{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:#9dffd8}
.wg-path-row-top em{font-style:normal;font-size:.72rem;color:#e0c878}
.wg-path-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.wg-path-opt{appearance:none;display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid rgba(120,150,200,.28);background:rgba(8,12,20,.8);color:#e8eef8;cursor:pointer;font-family:inherit;transition:border-color .12s,background .12s,transform .12s}
.wg-path-opt:hover:not(:disabled){border-color:rgba(224,178,82,.45);transform:translateY(-1px)}
.wg-path-opt.is-active{border-color:rgba(224,178,82,.8);background:rgba(224,178,82,.14);box-shadow:0 0 0 1px rgba(224,178,82,.2)}
.wg-path-opt:disabled{opacity:.45;cursor:not-allowed}
.wg-path-opt-name{font-size:.86rem;font-weight:600;color:#f0e6d0}
.wg-path-opt-desc{font-size:.72rem;line-height:1.35;color:#8fa3c4}
.wg-lane-tile{flex:1;min-width:100px;display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:12px;border:1px solid rgba(120,150,200,.25);background:rgba(6,9,14,.75);color:#e8eef8;cursor:pointer;font-family:inherit}
.wg-lane-tile strong{font-family:Cinzel,serif;color:#f0e6d0}
.wg-lane-tile span{font-size:.75rem;color:#8fa3c4}
.wg-lane-tile.is-active{border-color:rgba(224,178,82,.7);background:rgba(224,178,82,.12)}
.wg-dep-lanes{display:flex;flex-wrap:wrap;gap:8px}
.wg-dep-wave-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.wg-dep-wave{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:12px;background:rgba(6,9,14,.72);border:1px solid rgba(120,150,200,.16)}
.wg-dep-wave label{display:flex;flex-direction:column;gap:4px;font-size:.72rem;color:#8fa3c4;letter-spacing:.06em;text-transform:uppercase}
.wg-dep-wave select,.wg-lane-select{width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(120,150,200,.3);background:#0c121c;color:#e8eef8;font-family:inherit}
.wg-dep-army{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.wg-pregame-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:flex-end;padding:12px 4px 4px;position:sticky;bottom:0;background:linear-gradient(180deg,transparent,rgba(7,11,18,.97) 28%)}
.wg-pregame-summary{display:flex;flex-wrap:wrap;gap:8px 12px;margin-right:auto;font-size:.78rem;color:#a8b8d0}
.wg-pregame-summary span{padding:4px 10px;border-radius:999px;border:1px solid rgba(120,150,200,.2);background:rgba(8,12,20,.7)}
.wg-pregame-go{padding:14px 28px!important;font-size:1rem!important;letter-spacing:.08em!important;background:linear-gradient(180deg,#d4b05a,#8a6a28)!important;border:1px solid #e8d08a!important;color:#1a1208!important;font-weight:700!important;border-radius:12px!important;box-shadow:0 6px 22px rgba(224,178,82,.28)!important;cursor:pointer}
.wg-pregame-go:disabled{opacity:.45;cursor:not-allowed;box-shadow:none!important}
.wg-pregame-tagline{margin:4px 0 0;font-size:.78rem;color:#8fa3c4;letter-spacing:.02em}
.wg-pregame-checklist{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.wg-pregame-checklist li{padding:5px 12px;border-radius:999px;border:1px solid rgba(120,150,200,.28);font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:#8fa3c4;background:rgba(8,12,20,.65)}
.wg-pregame-checklist li.is-done{border-color:rgba(110,231,183,.45);color:#9dffd8;background:rgba(40,90,70,.25)}
.wg-pregame-board.is-split{grid-template-columns:1.15fr 1fr!important}
@media(max-width:960px){.wg-pregame-board.is-split{grid-template-columns:1fr!important}}
.wg-pregame-path .wg-path-grid{max-height:min(62vh,680px)}
.wg-pregame-deploy{max-height:min(70vh,760px);overflow:auto}
`;

const marker = "/* v71 pregame always-both board */";
if (!css.includes(marker)) {
  css += "\n" + marker + block;
  writeFileSync(cssPath, css);
  console.log("appended/upgraded pregame CSS (v71 always-both)");
} else if (!css.includes(".wg-pregame-shell")) {
  css += block;
  writeFileSync(cssPath, css);
  console.log("appended pregame CSS");
} else {
  console.log("pregame CSS already present (v71)");
}
