import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const tiRoot =
  process.env.TACTICAL_INFINITY_ROOT ?? path.resolve(appRoot, "..", "..", "..", "Tactical-Infinity");
const target = path.join(tiRoot, "public", "models");
const link = path.join(appRoot, "public", "models");

if (!fs.existsSync(target)) {
  console.error(`Tactical-Infinity models not found: ${target}`);
  console.error("Clone https://github.com/MolochDaGod/Tactical-Infinity.git first.");
  process.exit(1);
}

fs.mkdirSync(path.join(appRoot, "public"), { recursive: true });
try {
  fs.rmSync(link, { recursive: true, force: true });
} catch {
  /* junction may need rmdir */
}

execSync(`cmd /c mklink /J "${link}" "${target}"`, { stdio: "inherit" });
console.log(`Linked ${link} → ${target}`);