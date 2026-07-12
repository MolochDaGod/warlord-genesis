const hosts = [
  "https://warlord-genesis.vercel.app/",
  "https://warstrat.grudge-studio.com/",
  "https://grudge-studio.com/",
  "https://play.grudge-studio.com/",
  "https://client.grudge-studio.com/",
  "https://grudgewarlords.com/",
  "https://www.grudgewarlords.com/",
  "https://warlords.grudge-studio.com/",
];

for (const h of hosts) {
  try {
    const r = await fetch(h, { cache: "no-store", redirect: "follow" });
    const t = await r.text();
    const hits = [...t.matchAll(/index-warlord[^"'\\\s>]+/g)].map((m) => m[0]);
    const uniq = [...new Set(hits)];
    console.log(r.status, h, "=>", uniq.join(" | ") || "(no warlord bundle ref)");
  } catch (e) {
    console.log("ERR", h, e.message);
  }
}
