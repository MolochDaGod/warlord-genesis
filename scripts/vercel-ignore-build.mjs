#!/usr/bin/env node
/**
 * Skip Vercel git auto-build (8 GB OOM / competing gw-core path).
 * SPA ships from GHA or `pnpm run deploy:spa` (Vite prebuilt).
 * Exit 0 = skip. VERCEL_FORCE_BUILD=1 continues.
 */
if (process.env.VERCEL_FORCE_BUILD === "1") process.exit(1);
process.exit(0);
