import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const target = path.join(root, "lib", "api-zod", "src", "generated", "api.ts");

let src = readFileSync(target, "utf8");
src = src.replace(
  /import \* as zod from ['"]zod['"];/,
  'import * as zod from "zod/v4";',
);
writeFileSync(target, src);