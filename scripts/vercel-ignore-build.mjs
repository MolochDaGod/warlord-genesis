#!/usr/bin/env node
/**
 * Vercel ignored-build-step.
 * Exit 0 = skip this commit. Exit 1 = run buildCommand.
 *
 * Git snapshots omit hashed Vite JS (.gitignore assets/index-????????.js).
 * A clean Vercel git deploy would 404 the SPA bundle. Production ships via
 * `.github/workflows/deploy-spa.yml` (Vite pin + vercel CLI --prod --force).
 *
 * Set VERCEL_FORCE_GIT_BUILD=1 only when the hashed bundle is in the git tree.
 */
if (process.env.VERCEL_FORCE_GIT_BUILD === "1") process.exit(1);
process.exit(0);
