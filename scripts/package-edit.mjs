#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const manPath = join(ROOT, "deploy-manifest.json");
const pkgPath = join(ROOT, "package.json");
const readmePath = join(ROOT, "README.md");
const verifyPath = join(ROOT, "scripts", "verify-deploy.mjs");

const man = JSON.parse(readFileSync(manPath, "utf8"));
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

pkg.version = "0.2.0";
pkg.description =
  "Warlord Genesis / Warstrat — play, warcamp, map edit studio. https://warlord-genesis.vercel.app · https://warstrat.grudge-studio.com";
pkg.scripts = {
  ...pkg.scripts,
  "edit:verify":
    "node scripts/verify-deploy.mjs --live --url=https://warlord-genesis.vercel.app",
  "package:edit": "node scripts/print-edit-package.mjs",
};

const req = new Set(man.requiredStatic || []);
req.add("edit.html");
req.add("assets/map-edit.mjs");
man.requiredStatic = [...req];

const routes = [...(man.routes || [])];
if (!routes.some((r) => r.path === "/edit")) {
  const fb = routes.findIndex((r) => r.path === "*");
  const editRoutes = [
    {
      path: "/edit",
      id: "map-edit",
      screen: "Map scale + pathfinding route studio",
      component: "edit.html",
      package: "map-edit",
    },
    { path: "/map-edit", id: "map-edit-alias", redirect: "/edit" },
  ];
  if (fb >= 0) routes.splice(fb, 0, ...editRoutes);
  else routes.push(...editRoutes);
  man.routes = routes;
}

man.editPackage = {
  name: "map-edit",
  version: "0.2.0",
  entry: "edit.html",
  script: "assets/map-edit.mjs",
  dependencies: {
    three: "0.184.0 (CDN importmap — jsDelivr)",
    runtime: "browser ES modules; no npm install for static edit page",
  },
  routes: ["/edit", "/map-edit", "/edit.html"],
  features: [
    "map size standard/large + seed",
    "SI scales: terrain towers buildings trees props routeLift",
    "pathfinding grid A* or straight",
    "draw bottom/mid/top routes on terrain mesh",
  ],
};
man.packageVersion = "0.2.0";
man.lastPackaged = new Date().toISOString();

writeFileSync(manPath, JSON.stringify(man, null, 2) + "\n");
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

let vd = readFileSync(verifyPath, "utf8");
if (!vd.includes('"/edit"')) {
  vd = vd.replace(
    'for (const route of ["/", "/lobby", "/deploy", "/warcamp", "/play", "/battle", "/mp"])',
    'for (const route of ["/", "/lobby", "/deploy", "/warcamp", "/play", "/battle", "/mp", "/edit", "/edit.html"])',
  );
  vd = vd.replace(
    'for (const route of ["/lobby", "/deploy", "/play", "/warcamp", "/battle", "/mp"])',
    'for (const route of ["/lobby", "/deploy", "/play", "/warcamp", "/battle", "/mp", "/edit"])',
  );
}
if (!vd.includes("edit package missing")) {
  const inject = `
// Edit package (map scale + pathfinding studio)
for (const rel of ["edit.html", "assets/map-edit.mjs"]) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) fail(\`edit package missing: \${rel}\`);
  else ok(\`edit package: \${rel}\`);
}
if (existsSync(join(ROOT, "edit.html"))) {
  const eh = readFileSync(join(ROOT, "edit.html"), "utf8");
  if (!eh.includes("map-edit.mjs")) fail("edit.html must load assets/map-edit.mjs");
  else ok("edit.html loads map-edit.mjs");
}
if (existsSync(join(ROOT, "assets/map-edit.mjs"))) {
  const em = readFileSync(join(ROOT, "assets/map-edit.mjs"), "utf8");
  if (!em.includes("three")) fail("map-edit.mjs must import three");
  else ok("map-edit.mjs three dependency");
  if (!em.includes("findPath") && !em.includes("pathfind")) warn("map-edit.mjs may lack pathfinding");
  else ok("map-edit.mjs pathfinding present");
}

`;
  if (vd.includes("if (LIVE)")) vd = vd.replace("if (LIVE)", inject + "if (LIVE)");
  else vd += inject;
}
writeFileSync(verifyPath, vd);

let readme = readFileSync(readmePath, "utf8");
if (!readme.includes("/edit")) {
  const section = `
## Map Edit Studio (\`/edit\`)

Production map tooling for **terrain / tower / building scales** and **pathfinding routes**.

| | |
|--|--|
| **Live** | https://warlord-genesis.vercel.app/edit |
| **Alias** | \`/map-edit\` · \`/edit.html\` |
| **Package** | \`edit.html\` + \`assets/map-edit.mjs\` (static ship; Three.js via CDN importmap) |

### Features

- Choose **map size** (Standard / Large) and **seed**
- Scale layers (SI): terrain height, towers, buildings, trees, props, route lift
- Pathfinding: **Grid A\\*** (walk grid) or straight debug line
- Draw routes from structure **bottom · mid · top** anchors **on the terrain mesh**
- Prefs in \`localStorage\` (\`wg:map-edit:standalone:v1\`)

### Dependencies (edit package)

| Dep | How |
|-----|-----|
| **three@0.184** | CDN importmap in \`edit.html\` (jsDelivr) — no npm install for the static page |
| Game SPA (gw-core) | Separate; edit ships beside the battle bundle |

React source (future Vite builds): \`artifacts/grudge-warlords/src/pages/Edit.tsx\`.

### Verify

\`\`\`bash
pnpm run verify
pnpm run edit:verify
\`\`\`

`;
  if (readme.includes("## Play defaults")) {
    readme = readme.replace("## Play defaults", section + "\n## Play defaults");
  } else {
    readme += "\n" + section;
  }
  if (!readme.includes("**Map Edit**")) {
    readme = readme.replace(
      "| **Play** | `/play` on either host |",
      "| **Play** | `/play` on either host |\n| **Map Edit** | `/edit` — scale + pathfinding routes |",
    );
  }
  writeFileSync(readmePath, readme);
}

console.log(
  JSON.stringify(
    {
      packageVersion: pkg.version,
      editPackage: man.editPackage,
      requiredStaticEdit: man.requiredStatic.filter((x) => String(x).includes("edit")),
      routes: man.routes.filter((r) => String(r.path).includes("edit")),
    },
    null,
    2,
  ),
);
