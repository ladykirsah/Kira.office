import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { assertDeployableApiBase } from "./src/lib/apiBaseGuard";

// Kill a production build that would inline an unreachable API host. NEXT_PUBLIC_* is baked into
// the bundle at build time, so a build run from a shell still pointing at a dev server ships an
// admin where every page is dead — and types, tests, build and deploy all pass in silence. The
// storefront shipped exactly that bug with NEXT_PUBLIC_IMG_BASE on 2026-07-22; this is the twin
// guard flagged as a follow-up when that one landed.
assertDeployableApiBase(process.env.NEXT_PUBLIC_API_BASE, process.env.NODE_ENV === "production");

// TypeScript rather than .mjs (Next 15 loads either) purely so the guard above can be imported
// from a tested module instead of being retyped here where nothing checks it.
const nextConfig: NextConfig = {
  // Deployed to Cloudflare Workers via the OpenNext adapter (see open-next.config.ts).
  reactStrictMode: true,
  // The only lockfile lives at the REPO ROOT, but `next build` runs from apps/*, so Next infers a
  // workspace root of its own and warns. Point it at the actual root — otherwise file tracing can
  // also miss workspace packages (@l-shopee/core) that the bundle genuinely needs.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  // Verification builds set NEXT_DIST_DIR=.next-verify so they don't clobber the running
  // `next dev` output in .next. The real deploy build (OpenNext) uses the default .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
