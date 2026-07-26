#!/usr/bin/env node
/**
 * Wire tactical race paper-doll (design guide) into production loadout.
 *
 * Layout (docs/references/tactical-equipment-race-cards.png):
 *   slot 48px · gap 9px · pad 11px
 *   LEFT:  helm, chest, hands, legs, feet, ring
 *   RIGHT: weapon, offhand, necklace, shoulder, relic, bag(+)
 *
 * Art: assets/ui-kit/race-cards/{human,orc,elf,dwarf,barbarian,undead}.png
 * Run after fix-play-hud: node scripts/patch-race-cards.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = path.join(ROOT, "assets", "gw-core-20260713.js");
const CSS = path.join(ROOT, "assets", "index-BNWYZMT1.css");
const MANIFEST = path.join(ROOT, "deploy-manifest.json");
const MARK = "/*WG_RACE_CARDS_V2*/";
const CSS_MARK = "/* v2 tactical race paper-doll */";
const CACHE_HASH = "b25";

const RACES = ["human", "orc", "elf", "dwarf", "barbarian", "undead"];
const ART = path.join(ROOT, "assets", "ui-kit", "race-cards");
for (const r of RACES) {
  const p = path.join(ART, `${r}.png`);
  if (!fs.existsSync(p)) console.warn("missing race card art:", p);
  else console.log("art ok", r, fs.statSync(p).size);
}

const PAPER_JS = `${MARK}
const WgRaceCardUrl=r=>"/assets/ui-kit/race-cards/"+(WgNormRaceId(r)||"human")+".png";
function WgNormRaceId(r){const x=String(r||"human").toLowerCase();if(["human","orc","elf","dwarf","barbarian","undead"].includes(x))return x;if(x==="western-kingdoms"||x==="wk"||x==="humans")return"human";if(x==="barbarians"||x==="brb")return"barbarian";if(x==="high-elves"||x==="elves")return"elf";if(x==="dwarves"||x==="dwf")return"dwarf";if(x==="orcs")return"orc";if(x==="ud"||x==="undeads")return"undead";return"human"}
const WgRaceLabels={human:"HUMAN",orc:"ORC",elf:"ELF",dwarf:"DWARF",barbarian:"BARBARIAN",undead:"UNDEAD"};
/* tactical design: left armor R1-6, right weapons R1-6 */
const WgPaperLeft=[
  {id:"helm",label:"Helm",icon:"⛑"},
  {id:"chest",label:"Chest",icon:"👕"},
  {id:"hands",label:"Gauntlets",icon:"🖐"},
  {id:"legs",label:"Greaves",icon:"👖"},
  {id:"feet",label:"Boots",icon:"👢"},
  {id:"ring",label:"Ring",icon:"○"}
];
const WgPaperRight=[
  {id:"weapon",label:"Main Hand",icon:"⚔"},
  {id:"offhand",label:"Off Hand",icon:"🛡"},
  {id:"necklace",label:"Necklace",icon:"◆"},
  {id:"shoulder",label:"Shoulders",icon:"⚓"},
  {id:"relic",label:"Relic",icon:"✦"},
  {id:"bag",label:"Inventory",icon:"+",isAction:!0}
];
function WgRacePaperDoll({raceId:raceId,equipment:eq,activeSlot:active,onSlotClick:onClick,onBagClick:onBag}){
  const race=WgNormRaceId(raceId),bg=WgRaceCardUrl(race),lab=WgRaceLabels[race]||race.toUpperCase();
  const btn=(def,side)=>{
    const isBag=!!def.isAction||def.id==="bag",it=!isBag&&eq?eq[def.id]:null,filled=!!it,isOn=!isBag&&active===def.id;
    return d.jsxs("button",{type:"button",className:"gw-race-doll-slot is-"+side+(filled?" is-filled":"")+(isOn?" is-active":"")+(isBag?" is-action":""),title:isBag?def.label:(it?def.label+": "+it.name:def.label+" — empty"),onClick:()=>{if(isBag){onBag&&onBag();return}onClick&&onClick(def.id)},children:[
      d.jsx("span",{className:"gw-race-doll-slot-inner","aria-hidden":!0,children:filled?d.jsx("span",{className:"gw-race-doll-slot-glyph",children:"◆"}):d.jsx("span",{className:"gw-race-doll-slot-icon",children:def.icon})})
    ]},def.id)
  };
  return d.jsxs("div",{className:"gw-race-doll","data-race":race,children:[
    d.jsxs("header",{className:"gw-race-doll-head",children:[
      d.jsx("span",{className:"gw-race-doll-brand",children:"GRUDGE WARLORD"}),
      d.jsx("span",{className:"gw-race-doll-race",children:lab})
    ]}),
    d.jsxs("div",{className:"gw-race-doll-grid",children:[
      d.jsx("div",{className:"gw-race-doll-col is-left",children:WgPaperLeft.map(s=>btn(s,"left"))}),
      d.jsx("div",{className:"gw-race-doll-portrait",children:d.jsx("img",{className:"gw-race-doll-art",src:bg,alt:"Grudge Warlord "+lab,draggable:!1})}),
      d.jsx("div",{className:"gw-race-doll-col is-right",children:WgPaperRight.map(s=>btn(s,"right"))})
    ]})
  ]})}
`;

let js = fs.readFileSync(CORE, "utf8");

// Strip v1 inject if present so we can re-apply cleanly
if (js.includes("/*WG_RACE_CARDS_V1*/") || js.includes(MARK)) {
  // Remove old component block between mark and next function that was loadout
  const marks = ["/*WG_RACE_CARDS_V1*/", "/*WG_RACE_CARDS_V2*/"];
  for (const m of marks) {
    const i = js.indexOf(m);
    if (i < 0) continue;
    // find end: next "function " after doll definition that is not Wg*
    const after = js.indexOf("function ", i + m.length);
    // Prefer cutting until "function " that contains loadout-ish; safer: cut until we see children:"EQUIP
    const equip = js.indexOf('children:"EQUIP BEFORE THE ROUND"', i);
    if (equip > i) {
      const fn = js.lastIndexOf("function ", equip);
      if (fn > i) {
        js = js.slice(0, i) + js.slice(fn);
        console.log("stripped previous race-card inject");
      }
    }
  }
  // strip doll wrap from body if present
  js = js.replace(
    /d\.jsxs\("div",\{className:"gw-lo-doll-wrap",children:\[[\s\S]*?\]\}\),d\.jsx\("div",\{className:"gw-lo-slots"/,
    'd.jsx("div",{className:"gw-lo-slots"'
  );
}

{
  const anchor = 'children:"EQUIP BEFORE THE ROUND"';
  const ai = js.indexOf(anchor);
  if (ai < 0) throw new Error("loadout anchor not found");
  const fnStart = js.lastIndexOf("function ", ai);
  if (!js.includes(MARK)) {
    js = js.slice(0, fnStart) + PAPER_JS + js.slice(fnStart);
  }

  if (!js.includes("raceId=XI(q=>q.raceId)") && js.includes("e=XI(q=>q.prefabId),t=XI(q=>q.meleeId)")) {
    js = js.replace(
      "e=XI(q=>q.prefabId),t=XI(q=>q.meleeId)",
      'e=XI(q=>q.prefabId),raceId=XI(q=>q.raceId)||"human",t=XI(q=>q.meleeId)'
    );
  }

  const bodyOld =
    'd.jsxs("div",{className:"gw-lo-body",children:[d.jsx("div",{className:"gw-lo-slots"';
  const bodyNew =
    'd.jsxs("div",{className:"gw-lo-body",children:[d.jsxs("div",{className:"gw-lo-doll-wrap",children:[d.jsx(WgRacePaperDoll,{raceId:typeof raceId!=="undefined"?raceId:"human",equipment:C,activeSlot:M,onSlotClick:N,onBagClick:()=>N("weapon")}),d.jsx("p",{className:"gw-lo-doll-hint",children:"Tactical equip · 48px slots · left armor · right weapons"})]}),d.jsx("div",{className:"gw-lo-slots"';

  if (js.includes("gw-lo-doll-wrap")) {
    console.log("loadout body already has doll wrap");
  } else if (js.includes(bodyOld)) {
    js = js.replace(bodyOld, bodyNew);
    console.log("loadout body → tactical race paper doll");
  } else {
    console.warn("loadout body pattern not found");
  }

  if (!js.includes("WgRacePaperDoll")) throw new Error("WgRacePaperDoll missing after inject");

  fs.writeFileSync(CORE, js);
  for (const alias of ["assets/index-warlord-fix3.js", "assets/index-warlord-fix95.js"]) {
    const ap = path.join(ROOT, alias);
    if (fs.existsSync(ap)) fs.copyFileSync(CORE, ap);
  }
  console.log("wrote gw-core with tactical race paper doll");
}

// CSS — replace prior race-doll blocks
let css = fs.readFileSync(CSS, "utf8");
for (const mark of ["/* v1 race paper-doll cards */", CSS_MARK]) {
  const i = css.indexOf(mark);
  if (i >= 0) {
    // cut until next major marker
    let end = css.length;
    for (const next of ["/* === GW shell fix", "/* v75 play-hud", "/* v2 tactical"]) {
      const n = css.indexOf(next, i + mark.length);
      if (n > i && n < end) end = n;
    }
    // if our own mark, just remove from i to end of block by finding double newline patterns — simple: remove 2kb
    if (mark === CSS_MARK && end === css.length) {
      // keep rest after a reasonable chunk
    }
    css = css.slice(0, i) + css.slice(end);
  }
}

const raceCss = `
${CSS_MARK}
.gw-lo-body{display:grid!important;grid-template-columns:minmax(280px,340px) minmax(140px,180px) minmax(0,1fr)!important;gap:12px!important;align-items:start!important}
.gw-lo-doll-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}
.gw-lo-doll-hint{margin:0;font-size:10px;letter-spacing:.08em;color:#7f93b4;text-align:center;line-height:1.35;max-width:320px}
.gw-race-doll{--td-slot:48px;--td-gap:9px;--td-pad:11px;width:100%;max-width:340px;display:flex;flex-direction:column;border-radius:10px;border:1px solid rgba(224,178,82,.35);background:linear-gradient(180deg,#1a1410 0%,#0c0a08 100%);box-shadow:0 14px 40px rgba(0,0,0,.55),inset 0 0 0 1px rgba(0,0,0,.4);overflow:hidden}
.gw-race-doll-head{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 12px 6px;background:linear-gradient(180deg,rgba(80,40,20,.55),transparent);border-bottom:1px solid rgba(224,178,82,.18)}
.gw-race-doll-brand{font-family:Cinzel,"Cinzel Decorative",serif;font-size:11px;letter-spacing:.22em;font-weight:700;color:#e0c878;text-shadow:0 1px 4px #000}
.gw-race-doll-race{display:inline-flex;align-items:center;justify-content:center;min-width:56%;padding:4px 16px;border-radius:8px;border:1px solid rgba(120,150,200,.28);background:rgba(8,12,18,.75);font-size:12px;letter-spacing:.18em;font-weight:700;color:#f0e6d0}
.gw-race-doll-grid{display:grid;grid-template-columns:var(--td-slot) minmax(0,1fr) var(--td-slot);gap:var(--td-gap);padding:var(--td-pad);align-items:stretch}
.gw-race-doll-col{display:flex;flex-direction:column;gap:var(--td-gap);align-items:center}
.gw-race-doll-portrait{position:relative;min-height:calc(var(--td-slot)*6 + var(--td-gap)*5);border-radius:6px;overflow:hidden;background:rgba(0,0,0,.35);border:1px solid rgba(120,150,200,.15)}
.gw-race-doll-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;pointer-events:none;user-select:none}
.gw-race-doll-slot{width:var(--td-slot);height:var(--td-slot);flex:0 0 var(--td-slot);padding:0;margin:0;border-radius:8px;border:1px solid rgba(120,100,70,.55);background:linear-gradient(180deg,rgba(40,32,24,.92),rgba(18,14,10,.95));box-shadow:inset 0 1px 0 rgba(255,220,160,.08),0 2px 6px rgba(0,0,0,.4);cursor:pointer;transition:border-color .12s,box-shadow .12s,filter .12s}
.gw-race-doll-slot:hover{border-color:rgba(224,178,82,.7);box-shadow:0 0 12px rgba(224,178,82,.3);filter:brightness(1.1)}
.gw-race-doll-slot.is-active{border-color:#e0c878;box-shadow:0 0 14px rgba(224,178,82,.5)}
.gw-race-doll-slot.is-filled{border-color:rgba(157,255,216,.45)}
.gw-race-doll-slot.is-action{border-color:rgba(224,178,82,.75);background:linear-gradient(180deg,rgba(90,60,20,.55),rgba(40,28,10,.9))}
.gw-race-doll-slot.is-action .gw-race-doll-slot-icon{color:#e0c878;font-size:22px;font-weight:700}
.gw-race-doll-slot-inner{display:grid;place-items:center;width:100%;height:100%;pointer-events:none}
.gw-race-doll-slot-icon{font-size:18px;line-height:1;opacity:.55}
.gw-race-doll-slot-glyph{font-size:14px;color:#e0c878;text-shadow:0 1px 3px #000;line-height:1}
@media(max-width:900px){.gw-lo-body{grid-template-columns:1fr!important}.gw-race-doll{max-width:min(360px,96vw);margin:0 auto}}
`;

css = css.trimEnd() + "\n" + raceCss + "\n";
fs.writeFileSync(CSS, css);
console.log("CSS tactical paper-doll appended");

fs.writeFileSync(
  path.join(ART, "manifest.json"),
  JSON.stringify(
    {
      title: "Grudge Warlord tactical equipment race cards",
      guide: "docs/references/tactical-equipment-race-cards.png",
      metrics: { slotPx: 48, gapPx: 9, padPx: 11 },
      left: ["helm", "chest", "hands", "legs", "feet", "ring"],
      right: ["weapon", "offhand", "necklace", "shoulder", "relic", "bag"],
      races: RACES.map((id) => ({
        id,
        file: `${id}.png`,
        url: `/assets/ui-kit/race-cards/${id}.png`,
      })),
    },
    null,
    2
  ) + "\n"
);

if (fs.existsSync(MANIFEST) && fs.existsSync(CORE)) {
  const buf = fs.readFileSync(CORE);
  const sha = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
  const man = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  man.bundleFile = "assets/gw-core-20260713.js";
  man.bundleBytes = buf.length;
  man.bundleSha256 = sha;
  man.bundleCacheHash = CACHE_HASH;
  man.lastBuilt = new Date().toISOString();
  man.bundleChecks = man.bundleChecks || [];
  if (!man.bundleChecks.some((c) => c.id === "race-paper-doll")) {
    man.bundleChecks.push({ id: "race-paper-doll", needle: "WgRacePaperDoll" });
  }
  if (!man.bundleChecks.some((c) => c.id === "tactical-equip-metrics")) {
    man.bundleChecks.push({ id: "tactical-equip-metrics", needle: "gw-race-doll-grid" });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(man, null, 2) + "\n");
  console.log("deploy-manifest → sha", sha, "h", CACHE_HASH, "bytes", buf.length);
}

console.log("done");
