import fs from "fs";
import path from "path";

const BASE = "https://client.grudge-studio.com/models/maps";
const MODELS = {
  medieval: ["tower_02_1", "tower_03_1_full"],
  elven: ["tower_2", "tower_3_full"],
  orc: ["tower_02", "tower_3_full"],
  ruins: ["ruin_11", "ruin_15"],
};

const outRoot = path.join(import.meta.dirname, "..", "models", "towers");
fs.mkdirSync(outRoot, { recursive: true });

for (const [theme, names] of Object.entries(MODELS)) {
  const dir = path.join(outRoot, theme);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of names) {
    const url = `${BASE}/${theme}/${name}.glb`;
    // theme folder name matches map pack (medieval, elven, orc, ruins)
    const dest = path.join(dir, `${name}.glb`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    let buf = Buffer.from(await res.arrayBuffer());
    if (buf.length >= 8 && buf.slice(4, 8).toString() === "glTF" && buf.slice(0, 4).toString() !== "glTF") {
      buf = buf.subarray(4);
    }
    if (buf.slice(0, 4).toString() !== "glTF") {
      throw new Error(`${url} did not return a GLB`);
    }
    fs.writeFileSync(dest, buf);
    console.log("ok", dest, buf.length);
  }
  const atlasUrl = `${BASE}/${theme}/atlas.png`;
  const atlasRes = await fetch(atlasUrl);
  if (atlasRes.ok) {
    fs.writeFileSync(path.join(dir, "atlas.png"), Buffer.from(await atlasRes.arrayBuffer()));
    console.log("ok atlas", theme);
  }
}