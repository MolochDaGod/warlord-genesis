import { unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

for (const lib of ["api-client-react", "api-zod"]) {
  const info = path.join(root, "lib", lib, "tsconfig.tsbuildinfo");
  try {
    unlinkSync(info);
  } catch {
    // Fresh clone — nothing to invalidate.
  }
}