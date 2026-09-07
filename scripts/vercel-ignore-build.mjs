#!/usr/bin/env node
/**
 * Vercel ignored-build-step.
 * Exit 0 = skip this commit. Exit 1 = run buildCommand.
 *
 * Was hard-skip (OOM when compiling gw-core). CI is now verify-only
 * (`scripts/ci-build.mjs`) so production git ships must run — otherwise
 * LFS map redirects never leave main.
 *
 * VERCEL_SKIP_BUILD=1 still skips.
 */
if (process.env.VERCEL_SKIP_BUILD === "1") process.exit(0);
process.exit(1);
