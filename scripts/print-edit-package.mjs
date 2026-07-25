#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const m = JSON.parse(readFileSync(join(root, "deploy-manifest.json"), "utf8"));
console.log(JSON.stringify(m.editPackage ?? {}, null, 2));
