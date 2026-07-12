/** Probe whether live fix3 still serves the throwing build. */
const urls = [
  "https://warlord-genesis.vercel.app/assets/index-warlord-fix3.js",
  "https://warlord-genesis.vercel.app/assets/index-warlord-fix3.js?v=91",
  "https://warlord-genesis.vercel.app/assets/index-warlord-fix3.js?v=94",
  "https://warstrat.grudge-studio.com/assets/index-warlord-fix3.js?v=91",
  "https://warstrat.grudge-studio.com/assets/index-warlord-fix95.js?v=95",
];

for (const u of urls) {
  try {
    const r = await fetch(u, { cache: "no-store" });
    const t = await r.text();
    const safe = t.includes("gw-sprite-safe");
    const throws = t.includes('Sprite: "Raycaster.camera" needs to be set');
    const throwExpr = t.includes("A.camera===null&&PI(");
    console.log(
      r.status,
      "safe=" + safe,
      "msg=" + throws,
      "throwExpr=" + throwExpr,
      "len=" + t.length,
      u,
    );
  } catch (e) {
    console.log("ERR", u, e.message);
  }
}
